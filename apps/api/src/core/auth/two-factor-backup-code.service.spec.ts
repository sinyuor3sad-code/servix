import { TwoFactorBackupCodeService } from './two-factor-backup-code.service';
import { hash } from 'bcryptjs';

type PrismaModelOverrides = Partial<{
  deleteMany: jest.Mock;
  createMany: jest.Mock;
  findMany: jest.Mock;
  updateMany: jest.Mock;
  count: jest.Mock;
}>;

function makeService(overrides: PrismaModelOverrides = {}) {
  const twoFactorBackupCode = {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    count: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
  const prisma = {
    twoFactorBackupCode,
    // $transaction([...ops]) — resolve the array of promises (matches Prisma).
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const service = new TwoFactorBackupCodeService(prisma as never);
  return { service, prisma, twoFactorBackupCode };
}

describe('TwoFactorBackupCodeService', () => {
  describe('store', () => {
    it('replaces the set (delete old + insert) in one transaction, hashing each code', async () => {
      const { service, prisma, twoFactorBackupCode } = makeService();
      await service.store('user-1', ['AAAA-BBBB', 'CCCC-DDDD']);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(twoFactorBackupCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });

      const createArg = twoFactorBackupCode.createMany.mock.calls[0][0];
      expect(createArg.data).toHaveLength(2);
      // stored as bcrypt hashes, never plaintext
      expect(createArg.data[0].codeHash).not.toBe('AAAA-BBBB');
      expect(createArg.data[0].codeHash).toMatch(/^\$2[aby]\$/);
      expect(createArg.data[0].userId).toBe('user-1');
    });
  });

  describe('verifyAndConsume', () => {
    it('consumes a matching unused code via an atomic guarded UPDATE (single-use)', async () => {
      const codeHash = await hash('AAAA-BBBB', 12);
      const { service, twoFactorBackupCode } = makeService({
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', codeHash }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      });

      // case-insensitive / trims (normalize)
      const ok = await service.verifyAndConsume('user-1', '  aaaa-bbbb  ');
      expect(ok).toBe(true);
      expect(twoFactorBackupCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'c1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('loses the race when the row was already consumed concurrently (count === 0)', async () => {
      const codeHash = await hash('AAAA-BBBB', 12);
      const { service } = makeService({
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', codeHash }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      });
      expect(await service.verifyAndConsume('user-1', 'AAAA-BBBB')).toBe(false);
    });

    it('returns false when no stored code matches the input', async () => {
      const codeHash = await hash('AAAA-BBBB', 12);
      const { service, twoFactorBackupCode } = makeService({
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', codeHash }]),
      });
      expect(await service.verifyAndConsume('user-1', 'ZZZZ-ZZZZ')).toBe(false);
      expect(twoFactorBackupCode.updateMany).not.toHaveBeenCalled();
    });

    it('returns false when the user has no codes', async () => {
      const { service } = makeService();
      expect(await service.verifyAndConsume('user-1', 'AAAA-BBBB')).toBe(false);
    });

    it('only considers UNUSED codes (findMany filters usedAt: null)', async () => {
      const { service, twoFactorBackupCode } = makeService();
      await service.verifyAndConsume('user-1', 'AAAA-BBBB');
      expect(twoFactorBackupCode.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
        select: { id: true, codeHash: true },
      });
    });
  });

  describe('deleteAll / countUnused', () => {
    it('deleteAll removes every code for the user', async () => {
      const { service, twoFactorBackupCode } = makeService();
      await service.deleteAll('user-1');
      expect(twoFactorBackupCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('countUnused counts only unused codes', async () => {
      const { service, twoFactorBackupCode } = makeService({ count: jest.fn().mockResolvedValue(3) });
      expect(await service.countUnused('user-1')).toBe(3);
      expect(twoFactorBackupCode.count).toHaveBeenCalledWith({ where: { userId: 'user-1', usedAt: null } });
    });
  });
});
