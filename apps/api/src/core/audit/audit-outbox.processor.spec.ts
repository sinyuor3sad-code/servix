import { Test, TestingModule } from '@nestjs/testing';
import { register } from 'prom-client';
import { AuditOutboxProcessor } from './audit-outbox.processor';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import {
  AUDIT_OUTBOX_MAX_ATTEMPTS,
  METRIC_AUDIT_OUTBOX_DELIVERED_TOTAL,
  METRIC_AUDIT_OUTBOX_FAILED_TOTAL,
} from './audit-outbox.constants';

interface MockRow {
  id: string;
  tenant_id: string | null;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  attempts: number;
  created_at: Date;
}

const makeRow = (over: Partial<MockRow> = {}): MockRow => ({
  id: 'row-1',
  tenant_id: 'tenant-1',
  user_id: 'user-1',
  action: 'auth.login',
  entity_type: 'User',
  entity_id: 'user-1',
  old_values: null,
  new_values: { ip: '1.2.3.4' },
  ip_address: '1.2.3.4',
  user_agent: 'jest',
  attempts: 0,
  created_at: new Date('2026-05-30T10:00:00Z'),
  ...over,
});

describe('AuditOutboxProcessor (V-35b drain)', () => {
  let processor: AuditOutboxProcessor;

  const prisma = {
    $queryRaw: jest.fn(),
    platformAuditLog: { createMany: jest.fn() },
    auditOutbox: { update: jest.fn(), updateMany: jest.fn() },
  };

  const counterValue = async (name: string): Promise<number> => {
    const metric = register.getSingleMetric(name) as { get: () => Promise<{ values: { value: number }[] }> };
    const snap = await metric.get();
    return snap.values[0]?.value ?? 0;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    register.clear(); // reset the shared default registry between tests

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditOutboxProcessor, { provide: PlatformPrismaClient, useValue: prisma }],
    }).compile();

    processor = module.get(AuditOutboxProcessor);
  });

  it('delivers a claimed row idempotently and marks it delivered', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([makeRow()]);
    prisma.platformAuditLog.createMany.mockResolvedValueOnce({ count: 1 });
    prisma.auditOutbox.update.mockResolvedValueOnce({});

    const delivered = await processor.drainOnce();

    expect(delivered).toBe(1);
    // idempotent terminal insert: same id + skipDuplicates, original event time
    const insertArg = prisma.platformAuditLog.createMany.mock.calls[0][0];
    expect(insertArg.skipDuplicates).toBe(true);
    expect(insertArg.data[0]).toMatchObject({ id: 'row-1', userId: 'user-1' });
    expect(insertArg.data[0].createdAt).toEqual(new Date('2026-05-30T10:00:00Z'));
    // marked delivered with audit_log_id = outbox id
    expect(prisma.auditOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row-1' },
        data: expect.objectContaining({ status: 'delivered', auditLogId: 'row-1' }),
      }),
    );
    expect(await counterValue(METRIC_AUDIT_OUTBOX_DELIVERED_TOTAL)).toBe(1);
  });

  it('returns a transient failure to pending (retry) and bumps attempts', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([makeRow({ attempts: 0 })]);
    prisma.platformAuditLog.createMany.mockRejectedValueOnce(new Error('deadlock'));
    prisma.auditOutbox.update.mockResolvedValueOnce({});

    const delivered = await processor.drainOnce();

    expect(delivered).toBe(0);
    expect(prisma.auditOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', attempts: 1, lastError: 'deadlock' }),
      }),
    );
    expect(await counterValue(METRIC_AUDIT_OUTBOX_FAILED_TOTAL)).toBe(0);
  });

  it('dead-letters a poison row to terminal failed at max attempts', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([makeRow({ attempts: AUDIT_OUTBOX_MAX_ATTEMPTS - 1 })]);
    prisma.platformAuditLog.createMany.mockRejectedValueOnce(new Error('FK violation: user'));
    prisma.auditOutbox.update.mockResolvedValueOnce({});

    await processor.drainOnce();

    expect(prisma.auditOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', attempts: AUDIT_OUTBOX_MAX_ATTEMPTS }),
      }),
    );
    expect(await counterValue(METRIC_AUDIT_OUTBOX_FAILED_TOTAL)).toBe(1);
  });

  it('drains nothing when no pending rows are claimed', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    expect(await processor.drainOnce()).toBe(0);
    expect(prisma.platformAuditLog.createMany).not.toHaveBeenCalled();
  });

  it('sweeps rows stuck in processing back to pending', async () => {
    prisma.auditOutbox.updateMany.mockResolvedValueOnce({ count: 3 });

    const swept = await processor.sweepStuck();

    expect(swept).toBe(3);
    const arg = prisma.auditOutbox.updateMany.mock.calls[0][0];
    expect(arg.where.status).toBe('processing');
    expect(arg.where.updatedAt.lt).toBeInstanceOf(Date);
    expect(arg.data).toEqual({ status: 'pending' });
  });

  describe('tick / metrics / lifecycle', () => {
    it('tick() sweeps then drains', async () => {
      prisma.auditOutbox.updateMany.mockResolvedValueOnce({ count: 0 });
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await processor.tick();

      expect(prisma.auditOutbox.updateMany).toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('tick() skips when a drain is already in progress (overlap guard)', async () => {
      (processor as unknown as { draining: boolean }).draining = true;

      await processor.tick();

      expect(prisma.auditOutbox.updateMany).not.toHaveBeenCalled();
    });

    it('tick() swallows drain errors and resets the guard so the interval keeps firing', async () => {
      prisma.auditOutbox.updateMany.mockRejectedValueOnce(new Error('sweep boom'));

      await expect(processor.tick()).resolves.toBeUndefined();
      expect((processor as unknown as { draining: boolean }).draining).toBe(false);
    });

    it('exposes the lag gauge value via the registry collect hook', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ lag: 42 }]);

      const exposition = await register.metrics();
      const line = exposition
        .split('\n')
        .find((l) => l.startsWith('servix_audit_outbox_lag_seconds') && !l.startsWith('#'));

      expect(line).toBeDefined();
      expect(Number(line!.split(' ')[1])).toBe(42);
    });

    it('lag gauge collect never fails the /metrics scrape on a DB error', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('db down'));
      await expect(register.metrics()).resolves.toContain('servix_audit_outbox');
    });

    it('lag gauge reports 0 when nothing is pending', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]); // no pending rows
      const exposition = await register.metrics();
      const line = exposition
        .split('\n')
        .find((l) => l.startsWith('servix_audit_outbox_lag_seconds') && !l.startsWith('#'));
      expect(Number(line!.split(' ')[1])).toBe(0);
    });

    it('dead-letters cleanly even when the thrown error carries no message', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([makeRow({ attempts: AUDIT_OUTBOX_MAX_ATTEMPTS - 1 })]);
      prisma.platformAuditLog.createMany.mockRejectedValueOnce({}); // no `.message`
      prisma.auditOutbox.update.mockResolvedValueOnce({});

      await processor.drainOnce();

      expect(prisma.auditOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
      );
    });

    it('onModuleInit logs without throwing', () => {
      expect(() => processor.onModuleInit()).not.toThrow();
    });

    it('reuses already-registered metrics when instantiated twice on the default registry', () => {
      expect(() => new AuditOutboxProcessor(prisma as never)).not.toThrow();
    });
  });
});
