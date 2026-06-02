import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

describe('RefreshTokenCleanupService (V-13c-gc)', () => {
  const deleteMany = jest.fn();
  const service = new RefreshTokenCleanupService({
    refreshToken: { deleteMany },
  } as unknown as PlatformPrismaClient);

  beforeEach(() => deleteMany.mockReset());

  it('purges rows dead (revoked OR expired-and-never-reused) for >90 days', async () => {
    deleteMany.mockResolvedValueOnce({ count: 12 });
    const now = Date.now();

    await service.purgeDeadRefreshTokens();

    expect(deleteMany).toHaveBeenCalledTimes(1);
    const where = deleteMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(2);

    // Branch 1: revoked long ago. Cutoff ≈ now - 90d.
    const cutoff: Date = where.OR[0].revokedAt.lt;
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    expect(cutoff).toBeInstanceOf(Date);
    expect(now - cutoff.getTime()).toBeGreaterThanOrEqual(ninetyDaysMs - 5000);
    expect(now - cutoff.getTime()).toBeLessThanOrEqual(ninetyDaysMs + 5000);

    // Branch 2: never revoked but naturally expired long ago (same cutoff).
    expect(where.OR[1].AND).toEqual([
      { revokedAt: null },
      { expiresAt: { lt: cutoff } },
    ]);
  });

  it('never throws from the cron — DB errors are swallowed + logged', async () => {
    deleteMany.mockRejectedValueOnce(new Error('db unreachable'));
    await expect(service.purgeDeadRefreshTokens()).resolves.toBeUndefined();
  });

  it('is a no-op-safe when there is nothing to purge', async () => {
    deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.purgeDeadRefreshTokens()).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });
});
