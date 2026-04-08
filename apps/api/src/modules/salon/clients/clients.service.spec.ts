import { ClientsService } from './clients.service';
import { NotFoundException } from '@nestjs/common';

describe('ClientsService', () => {
  let service: ClientsService;

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockClient = {
    id: 'c1',
    fullName: 'سارة أحمد',
    phone: '0512345678',
    email: 'sara@test.com',
    gender: 'female',
    isActive: true,
    totalVisits: 5,
    totalSpent: 500,
    deletedAt: null,
    createdAt: new Date(),
  };

  const mockDb: any = {
    client: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientsService(mockAuditService as any);
  });

  describe('findAll', () => {
    it('should return paginated client list', async () => {
      mockDb.client.findMany.mockResolvedValue([mockClient]);
      mockDb.client.count.mockResolvedValue(1);

      const result = await service.findAll(mockDb, { page: 1, perPage: 20 } as any);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockDb.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          skip: 0,
        }),
      );
    });

    it('should filter by search term', async () => {
      mockDb.client.findMany.mockResolvedValue([]);
      mockDb.client.count.mockResolvedValue(0);

      await service.findAll(mockDb, { page: 1, perPage: 20, search: 'سارة' } as any);

      expect(mockDb.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ fullName: expect.objectContaining({ contains: 'سارة' }) }),
            ]),
          }),
        }),
      );
    });

    it('should filter by gender', async () => {
      mockDb.client.findMany.mockResolvedValue([]);
      mockDb.client.count.mockResolvedValue(0);

      await service.findAll(mockDb, { page: 1, perPage: 20, gender: 'female' } as any);

      expect(mockDb.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gender: 'female' }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a new client', async () => {
      mockDb.client.create.mockResolvedValue(mockClient);

      const result = await service.create(mockDb, {
        fullName: 'سارة أحمد',
        phone: '0512345678',
      } as any);

      expect(result).toBeDefined();
      expect(mockDb.client.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return client by id', async () => {
      mockDb.client.findFirst.mockResolvedValue(mockClient);

      const result = await service.findOne(mockDb, 'c1');

      expect(result.fullName).toBe('سارة أحمد');
    });

    it('should throw NotFoundException when client not found', async () => {
      mockDb.client.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockDb, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an existing client', async () => {
      mockDb.client.findFirst.mockResolvedValue(mockClient);
      mockDb.client.update.mockResolvedValue({ ...mockClient, fullName: 'سارة محمد' });

      const result = await service.update(mockDb, 'c1', { fullName: 'سارة محمد' } as any);

      expect(result.fullName).toBe('سارة محمد');
    });
  });

  describe('softDelete', () => {
    it('should soft-delete a client', async () => {
      mockDb.client.findFirst.mockResolvedValue(mockClient);
      mockDb.client.update.mockResolvedValue({ ...mockClient, deletedAt: new Date() });

      const result = await service.softDelete(mockDb, 'c1');

      expect(result.deletedAt).toBeDefined();
    });

    it('should throw when client not found', async () => {
      mockDb.client.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(mockDb, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
