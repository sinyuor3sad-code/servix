import { ServicesService } from './services.service';
import { NotFoundException } from '@nestjs/common';

describe('ServicesService', () => {
  let service: ServicesService;

  const mockService = {
    id: 's1',
    nameAr: 'قص شعر',
    nameEn: 'Haircut',
    price: 150,
    duration: 30,
    isActive: true,
    categoryId: 'cat1',
    category: { id: 'cat1', nameAr: 'شعر', nameEn: 'Hair' },
    sortOrder: 1,
  };

  const mockDb: any = {
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    serviceCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    appointmentService: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServicesService();
  });

  describe('findAll', () => {
    it('should return paginated services', async () => {
      mockDb.service.findMany.mockResolvedValue([mockService]);
      mockDb.service.count.mockResolvedValue(1);

      const result = await service.findAll(mockDb, { page: 1, perPage: 20 } as any);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by categoryId', async () => {
      mockDb.service.findMany.mockResolvedValue([]);
      mockDb.service.count.mockResolvedValue(0);

      await service.findAll(mockDb, { page: 1, perPage: 20, categoryId: 'cat1' } as any);

      expect(mockDb.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return service by id', async () => {
      mockDb.service.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne(mockDb, 's1');

      expect(result.nameAr).toBe('قص شعر');
      expect((result as any).price).toBe(150);
    });

    it('should throw when service not found', async () => {
      mockDb.service.findUnique.mockResolvedValue(null);

      await expect(service.findOne(mockDb, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create service with valid category', async () => {
      mockDb.serviceCategory.findUnique.mockResolvedValue({ id: 'cat1' });
      mockDb.service.create.mockResolvedValue(mockService);

      const result = await service.create(mockDb, {
        nameAr: 'قص شعر',
        nameEn: 'Haircut',
        price: 150,
        duration: 30,
        categoryId: 'cat1',
      } as any);

      expect(result).toBeDefined();
    });

    it('should throw when category not found', async () => {
      mockDb.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create(mockDb, { categoryId: 'nonexistent' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update existing service', async () => {
      mockDb.service.findUnique.mockResolvedValue(mockService);
      mockDb.service.update.mockResolvedValue({ ...mockService, price: 200 });

      const result = await service.update(mockDb, 's1', { price: 200 } as any);

      expect((result as any).price).toBe(200);
    });

    it('should throw when service not found', async () => {
      mockDb.service.findUnique.mockResolvedValue(null);

      await expect(service.update(mockDb, 'x', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should deactivate service', async () => {
      mockDb.service.findUnique.mockResolvedValue(mockService);
      mockDb.service.update.mockResolvedValue({ ...mockService, isActive: false });

      const result = await service.softDelete(mockDb, 's1');

      expect((result as any).isActive).toBe(false);
    });
  });

  describe('findAllCategories', () => {
    it('should return active categories', async () => {
      mockDb.serviceCategory.findMany.mockResolvedValue([
        { id: 'cat1', nameAr: 'شعر', isActive: true, _count: { services: 5 } },
      ]);

      const result = await service.findAllCategories(mockDb);

      expect(result).toHaveLength(1);
    });
  });
});
