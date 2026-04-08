import { CouponsService } from './coupons.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CouponsService', () => {
  let service: CouponsService;

  const validCoupon = {
    id: 'cp1',
    code: 'SAVE20',
    type: 'percentage',
    value: 20,
    minOrder: 100,
    maxDiscount: 50,
    usageLimit: 100,
    usedCount: 5,
    isActive: true,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2030-12-31'),
    createdAt: new Date(),
  };

  const mockDb: any = {
    coupon: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CouponsService();
  });

  describe('findAll', () => {
    it('should return paginated coupons', async () => {
      mockDb.coupon.findMany.mockResolvedValue([validCoupon]);
      mockDb.coupon.count.mockResolvedValue(1);

      const result = await service.findAll(mockDb, { page: 1, perPage: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('create', () => {
    it('should create a coupon', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(null);
      mockDb.coupon.create.mockResolvedValue(validCoupon);

      const result = await service.create(mockDb, {
        code: 'save20',
        type: 'percentage',
        value: 20,
        validFrom: '2024-01-01',
        validUntil: '2030-12-31',
      } as any);

      expect(result).toBeDefined();
      // Should uppercase the code
      expect(mockDb.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'SAVE20' } });
    });

    it('should throw ConflictException for duplicate code', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(validCoupon);

      await expect(
        service.create(mockDb, { code: 'SAVE20' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return coupon by id', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(validCoupon);

      const result = await service.findOne(mockDb, 'cp1');

      expect((result as any).code).toBe('SAVE20');
    });

    it('should throw NotFoundException', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(null);

      await expect(service.findOne(mockDb, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validate', () => {
    it('should validate a valid coupon (percentage)', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(validCoupon);

      const result = await service.validate(mockDb, {
        code: 'SAVE20',
        orderAmount: 200,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(40); // 200 * 20% = 40
    });

    it('should cap discount at maxDiscount', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(validCoupon);

      const result = await service.validate(mockDb, {
        code: 'SAVE20',
        orderAmount: 500,
      });

      // 500 * 20% = 100, but maxDiscount = 50
      expect(result.discountAmount).toBe(50);
    });

    it('should reject non-existent coupon', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(null);

      const result = await service.validate(mockDb, {
        code: 'FAKE',
        orderAmount: 100,
      });

      expect(result.valid).toBe(false);
    });

    it('should reject inactive coupon', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({ ...validCoupon, isActive: false });

      const result = await service.validate(mockDb, {
        code: 'SAVE20',
        orderAmount: 200,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('غير مفعّل');
    });

    it('should reject expired coupon', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        validUntil: new Date('2020-01-01'),
      });

      const result = await service.validate(mockDb, {
        code: 'SAVE20',
        orderAmount: 200,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('منتهي');
    });

    it('should reject when usage limit reached', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        usageLimit: 5,
        usedCount: 5,
      });

      const result = await service.validate(mockDb, {
        code: 'SAVE20',
        orderAmount: 200,
      });

      expect(result.valid).toBe(false);
    });

    it('should reject when order below minOrder', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(validCoupon);

      const result = await service.validate(mockDb, {
        code: 'SAVE20',
        orderAmount: 50, // minOrder is 100
      });

      expect(result.valid).toBe(false);
    });

    it('should validate fixed-value coupon', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        type: 'fixed',
        value: 30,
        maxDiscount: null,
      });

      const result = await service.validate(mockDb, {
        code: 'SAVE20',
        orderAmount: 200,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(30);
    });
  });

  describe('remove', () => {
    it('should delete coupon', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(validCoupon);
      mockDb.coupon.delete.mockResolvedValue(validCoupon);

      const result = await service.remove(mockDb, 'cp1');

      expect(result).toBeDefined();
    });
  });
});
