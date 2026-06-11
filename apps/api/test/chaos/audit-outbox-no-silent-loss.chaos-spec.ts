import { register } from 'prom-client';
import { AuditService } from '../../src/core/audit/audit.service';
import { AuditOutboxProcessor } from '../../src/core/audit/audit-outbox.processor';
import { AUDIT_OUTBOX_MAX_ATTEMPTS } from '../../src/core/audit/audit-outbox.constants';
import type { PlatformPrismaClient } from '../../src/shared/database/platform.client';

/**
 * V-35b — Chaos: the audit outbox must never silently lose an event.
 *
 * Corrected semantics vs the pre-outbox world (which asserted "business fails"):
 *  Case 1 — the terminal table (platform_audit_logs) is unavailable:
 *           the drain fails, rows pile up as `pending` (NOT lost), lag climbs
 *           (the alert would fire), enqueue keeps working, and once the table
 *           recovers every staged event is delivered. Zero loss.
 *  Case 2 — the outbox itself is unavailable at enqueue:
 *           the awaited write throws ⇒ the auth business op fails loudly (no
 *           silent loss). A tenant caller that wraps the call in `.catch()`
 *           swallows it — the documented residual gap (V-35-tenant-atomicity).
 *
 * Pure in-memory fake — no Postgres/Redis, matching the CI chaos contract.
 */

interface OutboxRow {
  id: string;
  tenantId: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
  auditLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}

function makeFakePrisma() {
  const outbox = new Map<string, OutboxRow>();
  const auditLogs = new Map<string, unknown>();
  let auditLogsDown = false;
  let seq = 0;

  const prisma = {
    __outbox: outbox,
    __auditLogs: auditLogs,
    setAuditLogsDown: (v: boolean) => {
      auditLogsDown = v;
    },

    auditOutbox: {
      create: jest.fn(async ({ data }: { data: Partial<OutboxRow> }) => {
        const id = data.id ?? `ob-${seq++}`;
        const now = new Date();
        const row: OutboxRow = {
          id,
          tenantId: data.tenantId ?? null,
          userId: data.userId as string,
          action: data.action as string,
          entityType: data.entityType as string,
          entityId: data.entityId as string,
          oldValues: data.oldValues ?? null,
          newValues: data.newValues ?? null,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          status: 'pending',
          attempts: 0,
          lastError: null,
          auditLogId: null,
          createdAt: now,
          updatedAt: now,
          processedAt: null,
        };
        outbox.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<OutboxRow> }) => {
        const row = outbox.get(where.id);
        if (row) Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },

    platformAuditLog: {
      createMany: jest.fn(
        async ({ data, skipDuplicates }: { data: { id: string }[]; skipDuplicates?: boolean }) => {
          if (auditLogsDown) {
            throw new Error('relation "platform_audit_logs" is unavailable');
          }
          let count = 0;
          for (const d of data) {
            if (skipDuplicates && auditLogs.has(d.id)) continue;
            auditLogs.set(d.id, d);
            count += 1;
          }
          return { count };
        },
      ),
    },

    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      if (sql.includes('UPDATE')) {
        // claim batch: pending → processing
        const pending = [...outbox.values()]
          .filter((r) => r.status === 'pending')
          .sort((a, b) => +a.createdAt - +b.createdAt);
        for (const r of pending) {
          r.status = 'processing';
          r.updatedAt = new Date();
        }
        return pending.map((r) => ({
          id: r.id,
          tenant_id: r.tenantId,
          user_id: r.userId,
          action: r.action,
          entity_type: r.entityType,
          entity_id: r.entityId,
          old_values: r.oldValues,
          new_values: r.newValues,
          ip_address: r.ipAddress,
          user_agent: r.userAgent,
          attempts: r.attempts,
          created_at: r.createdAt,
        }));
      }
      // lag query
      const pending = [...outbox.values()].filter((r) => r.status === 'pending');
      const lag = pending.length
        ? (Date.now() - Math.min(...pending.map((r) => +r.createdAt))) / 1000
        : 0;
      return [{ lag }];
    }),
  };

  return prisma;
}

const evt = (n: number) => ({
  userId: `00000000-0000-0000-0000-00000000000${n}`,
  action: 'auth.login',
  entityType: 'User',
  entityId: `00000000-0000-0000-0000-00000000000${n}`,
  newValues: { ip: '1.2.3.4' },
});

describe('Audit outbox — chaos: no silent loss', () => {
  let prisma: ReturnType<typeof makeFakePrisma>;
  let audit: AuditService;
  let processor: AuditOutboxProcessor;

  beforeEach(() => {
    prisma = makeFakePrisma();
    register.clear(); // reset the shared default registry between tests
    audit = new AuditService(prisma as unknown as PlatformPrismaClient);
    processor = new AuditOutboxProcessor(prisma as unknown as PlatformPrismaClient);
  });

  it('case 1: terminal table down ⇒ events stay durable in the outbox, lag climbs, then recover with zero loss', async () => {
    prisma.setAuditLogsDown(true);

    // Enqueue keeps working even while platform_audit_logs is unavailable.
    await audit.log(evt(1));
    await audit.log(evt(2));
    await audit.log(evt(3));
    expect(prisma.__outbox.size).toBe(3); // all staged — none lost

    // Backdate so accumulated lag is meaningful (simulating a real outage window).
    for (const row of prisma.__outbox.values()) {
      row.createdAt = new Date(Date.now() - 120_000);
    }

    // Drain while the table is down: deliveries fail, rows return to pending.
    const delivered = await processor.drainOnce();
    expect(delivered).toBe(0);
    expect(prisma.__auditLogs.size).toBe(0); // nothing delivered
    expect([...prisma.__outbox.values()].every((r) => r.status === 'pending' && r.attempts === 1)).toBe(
      true,
    ); // ZERO LOSS — every event is still queued for retry

    // The lag gauge reflects the backlog ⇒ the Prometheus alert (E1, V-35d) fires.
    const exposition = await register.metrics();
    const lagLine = exposition
      .split('\n')
      .find((l) => l.startsWith('servix_audit_outbox_lag_seconds') && !l.startsWith('#'));
    expect(lagLine).toBeDefined();
    expect(Number(lagLine!.split(' ')[1])).toBeGreaterThan(60);

    // Table recovers → the same staged events drain through. Still zero loss.
    prisma.setAuditLogsDown(false);
    const delivered2 = await processor.drainOnce();
    expect(delivered2).toBe(3);
    expect(prisma.__auditLogs.size).toBe(3);
    expect([...prisma.__outbox.values()].every((r) => r.status === 'delivered')).toBe(true);
  });

  it('case 1b: a permanently poison row dead-letters instead of inflating lag forever', async () => {
    prisma.setAuditLogsDown(true); // make every delivery attempt fail
    await audit.log(evt(9));

    // Drain MAX_ATTEMPTS times — the row should end terminal `failed`, not loop forever.
    for (let i = 0; i < AUDIT_OUTBOX_MAX_ATTEMPTS; i += 1) {
      await processor.drainOnce();
    }
    const row = [...prisma.__outbox.values()][0];
    expect(row.attempts).toBe(AUDIT_OUTBOX_MAX_ATTEMPTS);
    expect(row.status).toBe('failed');

    // A failed row no longer counts toward lag (alert clears once nothing is pending).
    const exposition = await register.metrics();
    const lagLine = exposition
      .split('\n')
      .find((l) => l.startsWith('servix_audit_outbox_lag_seconds') && !l.startsWith('#'));
    expect(Number(lagLine!.split(' ')[1])).toBe(0);
  });

  it('case 2: outbox enqueue failure is fail-loud on the auth path (business fails, no silent loss)', async () => {
    prisma.auditOutbox.create.mockRejectedValueOnce(new Error('platform DB down'));

    // Auth callers await log() without swallowing ⇒ the error propagates and the
    // business operation fails. The event is never silently dropped.
    await expect(audit.log(evt(1))).rejects.toThrow('platform DB down');
  });

  it('case 2b: documented residual gap — a tenant caller wrapping log() in .catch swallows a sustained outage', async () => {
    prisma.auditOutbox.create.mockRejectedValue(new Error('platform DB down'));

    // This mirrors the UNCHANGED salon/tenant call sites (E3/E4): `.catch(() => {})`.
    // It is the explicitly-accepted gap tracked as V-35-tenant-atomicity — asserted
    // here so the trade-off is visible and a future fix has a failing-by-design anchor.
    let swallowed = false;
    await audit.log(evt(1)).catch(() => {
      swallowed = true;
    });
    expect(swallowed).toBe(true);
    expect(prisma.__outbox.size).toBe(0); // event lost on a *sustained* outage (documented)
  });
});
