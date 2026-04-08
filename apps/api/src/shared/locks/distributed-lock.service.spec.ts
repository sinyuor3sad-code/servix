import { ConfigService } from '@nestjs/config';

// Setup Redis mock before importing the service
const mockSet = jest.fn();
const mockEval = jest.fn();
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      set: mockSet,
      eval: mockEval,
      on: mockOn,
    })),
  };
});

import { DistributedLockService } from './distributed-lock.service';

describe('DistributedLockService', () => {
  let service: DistributedLockService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      const config: Record<string, unknown> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: '',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DistributedLockService(
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully when key is free', async () => {
      mockSet.mockResolvedValue('OK');

      const lockId = await service.acquireLock('test-job', 60000);

      expect(lockId).toBeTruthy();
      expect(typeof lockId).toBe('string');
      expect(mockSet).toHaveBeenCalledWith(
        'test-job',
        expect.any(String),
        'PX',
        60000,
        'NX',
      );
    });

    it('should return null when lock is already held', async () => {
      mockSet.mockResolvedValue(null);

      const lockId = await service.acquireLock('test-job', 60000);

      expect(lockId).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockSet.mockRejectedValue(new Error('Redis down'));

      const lockId = await service.acquireLock('test-job', 60000);

      expect(lockId).toBeNull();
    });

    it('should use default TTL of 60000ms', async () => {
      mockSet.mockResolvedValue('OK');

      await service.acquireLock('test-job');

      expect(mockSet).toHaveBeenCalledWith(
        'test-job',
        expect.any(String),
        'PX',
        60000,
        'NX',
      );
    });
  });

  describe('releaseLock', () => {
    it('should release lock when we own it', async () => {
      mockEval.mockResolvedValue(1);

      const released = await service.releaseLock('test-job', 'my-lock-id');

      expect(released).toBe(true);
      expect(mockEval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'test-job',
        'my-lock-id',
      );
    });

    it('should NOT release lock when owned by another', async () => {
      mockEval.mockResolvedValue(0);

      const released = await service.releaseLock('test-job', 'wrong-id');

      expect(released).toBe(false);
    });

    it('should return false on Redis error', async () => {
      mockEval.mockRejectedValue(new Error('Redis down'));

      const released = await service.releaseLock('test-job', 'my-lock-id');

      expect(released).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute function when lock is acquired', async () => {
      mockSet.mockResolvedValue('OK');
      mockEval.mockResolvedValue(1);

      const fn = jest.fn().mockResolvedValue('result');
      const result = await service.withLock('test-job', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return null when lock cannot be acquired', async () => {
      mockSet.mockResolvedValue(null);

      const fn = jest.fn().mockResolvedValue('result');
      const result = await service.withLock('test-job', fn);

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should release lock even when function throws', async () => {
      mockSet.mockResolvedValue('OK');
      mockEval.mockResolvedValue(1);

      const fn = jest.fn().mockRejectedValue(new Error('task failed'));

      await expect(service.withLock('test-job', fn)).rejects.toThrow('task failed');
      expect(mockEval).toHaveBeenCalled(); // releaseLock was called
    });
  });
});
