import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { AuditService } from '../../../core/audit/audit.service';
import type { TenantPrismaClient } from '../../../shared/types';

const mockDb = {
  employee: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  employeeSchedule: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  employeeService: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  employeeBreak: {
    deleteMany: jest.fn(),
  },
  employeeDebt: {
    deleteMany: jest.fn(),
  },
  expense: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  appointment: {
    updateMany: jest.fn(),
  },
  appointmentService: {
    updateMany: jest.fn(),
  },
};

const mockPlatformPrisma = {
  user: { findUnique: jest.fn() },
  tenantUser: { create: jest.fn() },
  role: { findFirst: jest.fn() },
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('EmployeesService', () => {
  let service: EmployeesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PlatformPrismaClient, useValue: mockPlatformPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('يجب إرجاع قائمة الموظفين مع pagination', async () => {
      const employees = [
        { id: 'emp-1', fullName: 'فاطمة', commissionValue: 10 },
        { id: 'emp-2', fullName: 'سارة', commissionValue: 15 },
      ];
      mockDb.employee.findMany.mockResolvedValue(employees);
      mockDb.employee.count.mockResolvedValue(2);

      const result = await service.findAll(
        mockDb as unknown as TenantPrismaClient,
        { page: 1, limit: 10 } as never,
      );

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result.items).toHaveLength(2);
    });

    it('يجب فلترة الموظفين حسب الدور', async () => {
      mockDb.employee.findMany.mockResolvedValue([]);
      mockDb.employee.count.mockResolvedValue(0);

      await service.findAll(
        mockDb as unknown as TenantPrismaClient,
        { page: 1, limit: 10, role: 'stylist' } as never,
      );

      expect(mockDb.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'stylist' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('يجب إرجاع موظف بتفاصيل كاملة', async () => {
      mockDb.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        fullName: 'فاطمة',
        commissionValue: 10,
        employeeServices: [],
        employeeSchedules: [],
      });

      const result = await service.findOne(
        mockDb as unknown as TenantPrismaClient,
        'emp-1',
      );

      expect(result).toHaveProperty('fullName', 'فاطمة');
      expect(result).toHaveProperty('commissionValue', 10);
    });

    it('يجب رمي NotFoundException لموظف غير موجود', async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(mockDb as unknown as TenantPrismaClient, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('يجب إنشاء موظف جديد بنجاح', async () => {
      const newEmployee = {
        id: 'emp-new',
        fullName: 'نورة',
        phone: '+966501111111',
        role: 'stylist',
        commissionType: 'percentage',
        commissionValue: 10,
      };
      mockDb.employee.create.mockResolvedValue(newEmployee);

      const result = await service.create(
        mockDb as unknown as TenantPrismaClient,
        {
          fullName: 'نورة',
          phone: '+966501111111',
          role: 'stylist',
          commissionType: 'percentage',
          commissionValue: 10,
        } as never,
      );

      expect(result).toHaveProperty('fullName', 'نورة');
      expect(mockDb.employee.create).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'employee.create' }),
      );
    });
  });

  describe('update', () => {
    it('يجب تحديث بيانات الموظف', async () => {
      mockDb.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockDb.employee.update.mockResolvedValue({
        id: 'emp-1',
        fullName: 'فاطمة المحدّثة',
        commissionValue: 20,
      });

      const result = await service.update(
        mockDb as unknown as TenantPrismaClient,
        'emp-1',
        { fullName: 'فاطمة المحدّثة' } as never,
      );

      expect(result).toHaveProperty('fullName', 'فاطمة المحدّثة');
    });

    it('يجب رمي NotFoundException إذا لم يُوجد الموظف', async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          mockDb as unknown as TenantPrismaClient,
          'nonexistent',
          { fullName: 'test' } as never,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('يجب حذف الموظف نهائياً مع السجلات المرتبطة', async () => {
      mockDb.employee.findUnique.mockResolvedValue({ id: 'emp-1', email: null, fullName: 'Test' });
      mockDb.expense.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.employeeDebt.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.employeeService.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.employeeSchedule.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.employeeBreak.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.appointmentService.updateMany.mockResolvedValue({ count: 0 });
      mockDb.appointment.updateMany.mockResolvedValue({ count: 0 });
      mockDb.employee.delete.mockResolvedValue({ id: 'emp-1' });

      const result = await service.deactivate(
        mockDb as unknown as TenantPrismaClient,
        'tenant-1',
        'emp-1',
      );

      expect(result).toHaveProperty('deleted', true);
    });

    it('يجب رمي NotFoundException لموظف غير موجود', async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivate(mockDb as unknown as TenantPrismaClient, 'tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSchedule', () => {
    it('يجب إرجاع جدول عمل الموظف', async () => {
      mockDb.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockDb.employeeSchedule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isDayOff: false },
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isDayOff: false },
      ]);

      const result = await service.getSchedule(
        mockDb as unknown as TenantPrismaClient,
        'emp-1',
      );

      expect(result).toHaveLength(2);
    });
  });
});
