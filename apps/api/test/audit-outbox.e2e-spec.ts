import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Local-run e2e (not in CI — mirrors the repo's other API *.e2e-spec.ts, which
// run against a developer Postgres). Reads PLATFORM_DATABASE_URL from env (CI)
// or falls back to apps/api/.env (local) since dotenv isn't a direct dep here.
if (!process.env.PLATFORM_DATABASE_URL) {
  try {
    const envFile = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
    const m = envFile.match(/^PLATFORM_DATABASE_URL=(.+)$/m);
    if (m) process.env.PLATFORM_DATABASE_URL = m[1].trim();
  } catch {
    /* leave unset — the suite will fail fast with a clear connect error */
  }
}

import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { AuditService } from '../src/core/audit/audit.service';
import { AuditOutboxProcessor } from '../src/core/audit/audit-outbox.processor';
import { AUDIT_OUTBOX_MAX_ATTEMPTS } from '../src/core/audit/audit-outbox.constants';

/**
 * V-35b — outbox relay e2e against a real platform DB.
 *
 * Instantiates the classes directly (no Nest module) so the @Interval drain
 * never auto-fires — every drain/sweep here is explicit and deterministic.
 *
 * Covers: tenant reliable-enqueue → drain → delivered; idempotency (re-drain,
 * no duplicate); poison → terminal failed; crash sweeper; and the auth atomic
 * guarantee (audit row joins the business tx and rolls back with it).
 */
describe('Audit outbox relay (V-35b) — e2e', () => {
  let prisma: PlatformPrismaClient;
  let audit: AuditService;
  let processor: AuditOutboxProcessor;
  const createdUserIds: string[] = [];

  const makeUser = async (): Promise<string> => {
    const id = randomUUID();
    const tag = id.slice(0, 8);
    await prisma.user.create({
      data: {
        id,
        fullName: `Outbox Test ${tag}`,
        email: `outbox-${tag}@test.local`,
        phone: `+96650${tag.slice(0, 7)}`,
        passwordHash: 'x'.repeat(20),
      },
    });
    createdUserIds.push(id);
    return id;
  };

  beforeAll(async () => {
    prisma = new PlatformPrismaClient();
    await prisma.$connect();
    audit = new AuditService(prisma);
    processor = new AuditOutboxProcessor(prisma);
  });

  afterAll(async () => {
    // Scoped cleanup: only rows this suite created (outbox is the suite's only writer).
    await prisma.auditOutbox.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.platformAuditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Isolate drain/lag assertions from prior tests' rows.
    await prisma.auditOutbox.deleteMany({});
  });

  it('enqueues a pending row and drains it into platform_audit_logs (tenant reliable-enqueue path)', async () => {
    const userId = await makeUser();
    await audit.log({ userId, action: 'invoice.create', entityType: 'Invoice', entityId: userId });

    const pending = await prisma.auditOutbox.findFirst({ where: { userId } });
    expect(pending?.status).toBe('pending');
    expect(pending?.attempts).toBe(0);

    const delivered = await processor.drainOnce();
    expect(delivered).toBeGreaterThanOrEqual(1);

    const row = await prisma.auditOutbox.findFirst({ where: { userId } });
    expect(row?.status).toBe('delivered');
    expect(row?.auditLogId).toBe(row?.id);

    // audit_logs got exactly one row, sharing the outbox id, preserving event time.
    const logs = await prisma.platformAuditLog.findMany({ where: { userId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(row?.id);
  });

  it('is idempotent: re-draining a re-pending row never duplicates the audit log', async () => {
    const userId = await makeUser();
    await audit.log({ userId, action: 'auth.login', entityType: 'User', entityId: userId });
    await processor.drainOnce();

    const row = await prisma.auditOutbox.findFirstOrThrow({ where: { userId } });
    // Simulate a crash AFTER the audit_logs insert but BEFORE the status flip:
    // the sweeper would return this row to pending and it gets re-drained.
    await prisma.auditOutbox.update({ where: { id: row.id }, data: { status: 'pending' } });

    await processor.drainOnce();

    const logs = await prisma.platformAuditLog.findMany({ where: { userId } });
    expect(logs).toHaveLength(1); // ON CONFLICT (id) DO NOTHING ⇒ exactly-once
  });

  it('dead-letters a poison row (dangling user_id) to terminal failed after max attempts', async () => {
    const ghostUser = randomUUID(); // never inserted ⇒ FK violation on the terminal insert
    await audit.log({ userId: ghostUser, action: 'auth.login', entityType: 'User', entityId: ghostUser });

    for (let i = 0; i < AUDIT_OUTBOX_MAX_ATTEMPTS; i += 1) {
      await processor.drainOnce();
    }

    const row = await prisma.auditOutbox.findFirst({ where: { userId: ghostUser } });
    expect(row?.status).toBe('failed');
    expect(row?.attempts).toBe(AUDIT_OUTBOX_MAX_ATTEMPTS);
    expect(row?.lastError).toBeTruthy();

    // Poison never reached the audit log, and won't retry forever.
    const logs = await prisma.platformAuditLog.findMany({ where: { userId: ghostUser } });
    expect(logs).toHaveLength(0);

    await prisma.auditOutbox.deleteMany({ where: { userId: ghostUser } });
  });

  it('sweeps a row orphaned in processing back to pending', async () => {
    const userId = await makeUser();
    await audit.log({ userId, action: 'auth.login', entityType: 'User', entityId: userId });
    const row = await prisma.auditOutbox.findFirstOrThrow({ where: { userId } });

    // Force the "crashed mid-drain" state: processing + a stale updatedAt.
    await prisma.$executeRaw`
      UPDATE "platform_audit_outbox"
      SET "status" = 'processing', "updated_at" = now() - interval '10 minutes'
      WHERE "id" = ${row.id}::uuid
    `;

    const swept = await processor.sweepStuck();
    expect(swept).toBeGreaterThanOrEqual(1);

    const after = await prisma.auditOutbox.findUnique({ where: { id: row.id } });
    expect(after?.status).toBe('pending');
  });

  it('AUTH ATOMIC: an audit write inside a failing tx rolls back with the business write (no orphan, no loss)', async () => {
    const userId = randomUUID();
    const tag = userId.slice(0, 8);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            fullName: `Atomic ${tag}`,
            email: `atomic-${tag}@test.local`,
            phone: `+96651${tag.slice(0, 7)}`,
            passwordHash: 'x'.repeat(20),
          },
        });
        // audit row joins THIS tx (the register-flow guarantee)
        await audit.log(
          { userId, action: 'auth.register', entityType: 'User', entityId: userId },
          tx,
        );
        throw new Error('business failure after audit write');
      }),
    ).rejects.toThrow('business failure after audit write');

    // Both the user AND the audit row must be gone — atomic rollback, no orphan.
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.auditOutbox.findFirst({ where: { userId } })).toBeNull();
  });

  it('AUTH ATOMIC (commit): a successful tx persists both the business write and the audit row', async () => {
    const userId = randomUUID();
    const tag = userId.slice(0, 8);
    createdUserIds.push(userId);

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          fullName: `Atomic OK ${tag}`,
          email: `atomicok-${tag}@test.local`,
          phone: `+96652${tag.slice(0, 7)}`,
          passwordHash: 'x'.repeat(20),
        },
      });
      await audit.log(
        { userId, action: 'auth.register', entityType: 'User', entityId: userId },
        tx,
      );
    });

    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    const row = await prisma.auditOutbox.findFirst({ where: { userId } });
    expect(row?.status).toBe('pending');

    // and it drains through cleanly
    await processor.drainOnce();
    const drained = await prisma.auditOutbox.findFirst({ where: { userId } });
    expect(drained?.status).toBe('delivered');
  });

  it('MULTI-INSTANCE: two concurrent drains (api-1 + api-2) never double-promote a row', async () => {
    const userId = await makeUser();
    const N = 12;
    for (let i = 0; i < N; i += 1) {
      await audit.log({ userId, action: 'auth.login', entityType: 'User', entityId: userId });
    }

    // A second client = second pool = a genuinely separate connection, so the two
    // drains race at the DB level (as api-1/api-2 do in prod).
    const prisma2 = new PlatformPrismaClient();
    await prisma2.$connect();
    const processor2 = new AuditOutboxProcessor(prisma2);
    try {
      const [a, b] = await Promise.all([processor.drainOnce(), processor2.drainOnce()]);
      // FOR UPDATE SKIP LOCKED ⇒ disjoint claims; each row delivered exactly once.
      expect(a + b).toBe(N);
    } finally {
      await prisma2.$disconnect();
    }

    // ON CONFLICT (id) DO NOTHING guarantees no duplicate audit_logs under the race.
    const logs = await prisma.platformAuditLog.findMany({ where: { userId } });
    expect(logs).toHaveLength(N);
    const rows = await prisma.auditOutbox.findMany({ where: { userId } });
    expect(rows.every((r) => r.status === 'delivered')).toBe(true);
  });
});
