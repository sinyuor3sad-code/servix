import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CommitmentsService } from '../commitments/commitments.service';
import { InventoryService } from '../inventory/inventory.service';
import type { TenantPrismaClient } from '../../../shared/types';
import { AppointmentStatusEnum } from './dto/change-status.dto';

const mockDb = {
  client: { findFirst: jest.fn(), update: jest.fn() },
  service: { findMany: jest.fn() },
  employee: { findUnique: jest.fn() },
  attendance: { findUnique: jest.fn().mockResolvedValue(null) },
  employeeSchedule: { findUnique: jest.fn().mockResolvedValue(null) },
  appointment: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  appointmentService: { createMany: jest.fn() },
  commitment: { findFirst: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

const mockCommitmentsService = {
  create: jest.fn().mockResolvedValue({ id: 'commitment-1' }),
  linkDependency: jest.fn().mockResolvedValue({}),
};

const mockInventoryService = {
  autoDeductForAppointment: jest.fn().mockResolvedValue(undefined),
};

import { AuditService } from '../../../core/audit/audit.service';
import { CalendarService } from '../../../shared/calendar/calendar.service';

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockCalendarService = {
  generateIcsUrl: jest.fn().mockReturnValue('https://cal.example.com/test.ics'),
  generateIcsContent: jest.fn().mockReturnValue('BEGIN:VCALENDAR...'),
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: CommitmentsService, useValue: mockCommitmentsService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CalendarService, useValue: mockCalendarService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
  });

  describe('create - conflict prevention', () => {
    it('يجب أن يرمي ConflictException عند وجود موعد متعارض للموظف', async () => {
      mockDb.client.findFirst.mockResolvedValue({
        id: 'client-1',
        fullName: 'سارة',
      });
      mockDb.service.findMany.mockResolvedValue([
        { id: 'svc-1', price: 50, duration: 30 },
      ]);
      // Phase 1: conflict detection uses $queryRaw SELECT FOR UPDATE
      const mockQueryRaw = jest.fn().mockResolvedValue([{ id: 'existing-app' }]);
      mockDb.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({ ...mockDb, $queryRaw: mockQueryRaw }),
      );

      await expect(
        service.create(mockDb as unknown as TenantPrismaClient, {
          clientId: 'client-1',
          services: [{ serviceId: 'svc-1', employeeId: 'emp-1' }],
          date: '2026-04-15',
          startTime: '14:15',
        } as never),
      ).rejects.toThrow(ConflictException);

      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it('يجب أن يسمح بالإنشاء عند عدم وجود تعارض', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockDb.service.findMany.mockResolvedValue([
        { id: 'svc-1', price: 50, duration: 30 },
      ]);
      mockDb.appointment.findFirst.mockResolvedValue(null);
      mockDb.appointment.create.mockResolvedValue({
        id: 'new-app',
        clientId: 'client-1',
        employeeId: 'emp-1',
        date: new Date('2026-04-15'),
        startTime: '15:00',
        endTime: '15:30',
        totalPrice: 50,
        totalDuration: 30,
      });
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'new-app',
        client: { fullName: 'سارة' },
        employee: { fullName: 'فاطمة' },
        appointmentServices: [],
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: {
              ...mockDb.appointment,
              create: mockDb.appointment.create,
              findUnique: mockDb.appointment.findUnique,
            },
            appointmentService: mockDb.appointmentService,
          };
          return fn(tx);
        },
      );

      const result = await service.create(
        mockDb as unknown as TenantPrismaClient,
        {
          clientId: 'client-1',
          employeeId: 'emp-1',
          services: [{ serviceId: 'svc-1', employeeId: 'emp-1' }],
          date: '2026-04-15',
          startTime: '15:00',
        } as never,
      );

      expect(result).toHaveProperty('id', 'new-app');
      // Phase 1: conflict detection uses $queryRaw, not findFirst
      expect(mockDb.$queryRaw).toHaveBeenCalled();
    });

    it('يجب أن يرمي NotFoundException عندما لا يوجد العميل', async () => {
      mockDb.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create(mockDb as unknown as TenantPrismaClient, {
          clientId: 'nonexistent',
          services: [{ serviceId: 'svc-1', employeeId: 'emp-1' }],
          date: '2026-04-15',
          startTime: '14:00',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('يجب أن يرمي BadRequestException عندما لا توجد الخدمة', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockDb.service.findMany.mockResolvedValue([]);

      await expect(
        service.create(mockDb as unknown as TenantPrismaClient, {
          clientId: 'client-1',
          services: [{ serviceId: 'svc-nonexistent', employeeId: 'emp-1' }],
          date: '2026-04-15',
          startTime: '14:00',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب أن يحسب totalDuration بشكل صحيح من خدمات متعددة', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockDb.service.findMany.mockResolvedValue([
        { id: 'svc-1', price: 50, duration: 30 },
        { id: 'svc-2', price: 80, duration: 60 },
      ]);
      mockDb.appointment.findFirst.mockResolvedValue(null);
      mockDb.appointment.create.mockResolvedValue({
        id: 'new-app',
        totalDuration: 90,
        totalPrice: 130,
        endTime: '15:30',
      });
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'new-app',
        client: {},
        employee: {},
        appointmentServices: [],
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: {
              ...mockDb.appointment,
              create: mockDb.appointment.create,
              findUnique: mockDb.appointment.findUnique,
            },
            appointmentService: mockDb.appointmentService,
          };
          return fn(tx);
        },
      );

      await service.create(mockDb as unknown as TenantPrismaClient, {
        clientId: 'client-1',
        services: [
          { serviceId: 'svc-1', employeeId: 'emp-1' },
          { serviceId: 'svc-2', employeeId: 'emp-1' },
        ],
        date: '2026-04-15',
        startTime: '14:00',
      } as never);

      expect(mockDb.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalDuration: 90,
          }),
        }),
      );
    });

    it('يجب أن يحسب totalPrice بشكل صحيح من خدمات متعددة', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockDb.service.findMany.mockResolvedValue([
        { id: 'svc-1', price: 50, duration: 30 },
        { id: 'svc-2', price: 80, duration: 60 },
      ]);
      mockDb.appointment.findFirst.mockResolvedValue(null);
      mockDb.appointment.create.mockResolvedValue({
        id: 'new-app',
        totalDuration: 90,
        totalPrice: 130,
        endTime: '15:30',
      });
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'new-app',
        client: {},
        employee: {},
        appointmentServices: [],
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            $queryRaw: jest.fn().mockResolvedValue([]),
            appointment: {
              ...mockDb.appointment,
              create: mockDb.appointment.create,
              findUnique: mockDb.appointment.findUnique,
            },
            appointmentService: mockDb.appointmentService,
          };
          return fn(tx);
        },
      );

      await service.create(mockDb as unknown as TenantPrismaClient, {
        clientId: 'client-1',
        services: [
          { serviceId: 'svc-1', employeeId: 'emp-1' },
          { serviceId: 'svc-2', employeeId: 'emp-1' },
        ],
        date: '2026-04-15',
        startTime: '14:00',
      } as never);

      expect(mockDb.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalPrice: 130,
          }),
        }),
      );
    });

    it('يجب أن يحسب endTime بشكل صحيح (مثال: 14:00 + 90 دقيقة = 15:30)', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockDb.service.findMany.mockResolvedValue([
        { id: 'svc-1', price: 50, duration: 30 },
        { id: 'svc-2', price: 80, duration: 60 },
      ]);
      mockDb.appointment.findFirst.mockResolvedValue(null);
      mockDb.appointment.create.mockResolvedValue({
        id: 'new-app',
        totalDuration: 90,
        totalPrice: 130,
        endTime: '15:30',
      });
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'new-app',
        client: {},
        employee: {},
        appointmentServices: [],
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: {
              ...mockDb.appointment,
              create: mockDb.appointment.create,
              findUnique: mockDb.appointment.findUnique,
            },
            appointmentService: mockDb.appointmentService,
          };
          return fn(tx);
        },
      );

      await service.create(mockDb as unknown as TenantPrismaClient, {
        clientId: 'client-1',
        services: [
          { serviceId: 'svc-1', employeeId: 'emp-1' },
          { serviceId: 'svc-2', employeeId: 'emp-1' },
        ],
        date: '2026-04-15',
        startTime: '14:00',
      } as never);

      expect(mockDb.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endTime: '15:30',
          }),
        }),
      );
    });
  });

  describe('changeStatus - status transitions', () => {
    it('يجب أن يسمح بالانتقال من pending إلى confirmed', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'pending',
        clientId: 'client-1',
        totalPrice: 100,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        status: 'confirmed',
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: mockDb.appointment,
            client: mockDb.client,
          };
          return fn(tx);
        },
      );

      const result = await service.changeStatus(
        mockDb as unknown as TenantPrismaClient,
        'app-1',
        { status: AppointmentStatusEnum.confirmed },
      );

      expect(result).toHaveProperty('status', 'confirmed');
      expect(mockDb.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
    });

    it('يجب أن يسمح بالانتقال من confirmed إلى in_progress', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'confirmed',
        clientId: 'client-1',
        totalPrice: 100,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        status: 'in_progress',
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: mockDb.appointment,
            client: mockDb.client,
          };
          return fn(tx);
        },
      );

      const result = await service.changeStatus(
        mockDb as unknown as TenantPrismaClient,
        'app-1',
        { status: AppointmentStatusEnum.in_progress },
      );

      expect(result).toHaveProperty('status', 'in_progress');
    });

    it('يجب أن يسمح بالانتقال من in_progress إلى completed', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'in_progress',
        clientId: 'client-1',
        totalPrice: 150,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        status: 'completed',
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: mockDb.appointment,
            client: mockDb.client,
          };
          return fn(tx);
        },
      );

      const result = await service.changeStatus(
        mockDb as unknown as TenantPrismaClient,
        'app-1',
        { status: AppointmentStatusEnum.completed },
      );

      expect(result).toHaveProperty('status', 'completed');
      expect(mockDb.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: expect.objectContaining({
          totalVisits: { increment: 1 },
          totalSpent: { increment: 150 },
        }),
      });
    });

    it('يجب أن يرفض الانتقال من completed إلى أي حالة أخرى', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'completed',
        clientId: 'client-1',
        totalPrice: 100,
      });

      await expect(
        service.changeStatus(
          mockDb as unknown as TenantPrismaClient,
          'app-1',
          { status: AppointmentStatusEnum.confirmed },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.appointment.update).not.toHaveBeenCalled();
    });

    it('يجب أن يرفض الانتقال من cancelled إلى أي حالة أخرى', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'cancelled',
        clientId: 'client-1',
        totalPrice: 100,
      });

      await expect(
        service.changeStatus(
          mockDb as unknown as TenantPrismaClient,
          'app-1',
          { status: AppointmentStatusEnum.confirmed },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.appointment.update).not.toHaveBeenCalled();
    });

    it('يجب أن يرفض الانتقال من no_show إلى أي حالة أخرى', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'no_show',
        clientId: 'client-1',
        totalPrice: 100,
      });

      await expect(
        service.changeStatus(
          mockDb as unknown as TenantPrismaClient,
          'app-1',
          { status: AppointmentStatusEnum.confirmed },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.appointment.update).not.toHaveBeenCalled();
    });

    it('يجب أن يرفض الانتقال من pending إلى completed (قفزة غير صالحة)', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'pending',
        clientId: 'client-1',
        totalPrice: 100,
      });

      await expect(
        service.changeStatus(
          mockDb as unknown as TenantPrismaClient,
          'app-1',
          { status: AppointmentStatusEnum.completed },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.appointment.update).not.toHaveBeenCalled();
    });

    it('يجب أن يضبط cancelledAt و cancellationReason عند الإلغاء', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'confirmed',
        clientId: 'client-1',
        totalPrice: 100,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'طلب العميل',
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: mockDb.appointment,
            client: mockDb.client,
          };
          return fn(tx);
        },
      );

      await service.changeStatus(
        mockDb as unknown as TenantPrismaClient,
        'app-1',
        {
          status: AppointmentStatusEnum.cancelled,
          cancellationReason: 'طلب العميل',
        },
      );

      expect(mockDb.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cancelled',
            cancelledAt: expect.any(Date),
            cancellationReason: 'طلب العميل',
          }),
        }),
      );
    });

    it('يجب أن يزيد totalVisits و totalSpent للعميل عند الإكمال', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'in_progress',
        clientId: 'client-1',
        totalPrice: 200,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        status: 'completed',
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: mockDb.appointment,
            client: mockDb.client,
          };
          return fn(tx);
        },
      );

      await service.changeStatus(
        mockDb as unknown as TenantPrismaClient,
        'app-1',
        { status: AppointmentStatusEnum.completed },
      );

      expect(mockDb.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          totalVisits: { increment: 1 },
          totalSpent: { increment: 200 },
          lastVisitAt: expect.any(Date),
        },
      });
    });
  });

  describe('update', () => {
    it('يجب أن يحدّث date و startTime', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'pending',
        totalDuration: 60,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        date: new Date('2026-04-20'),
        startTime: '16:00',
        endTime: '17:00',
      });

      const result = await service.update(
        mockDb as unknown as TenantPrismaClient,
        'app-1',
        {
          date: '2026-04-20',
          startTime: '16:00',
        },
      );

      expect(result).toBeDefined();
      expect(mockDb.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            date: new Date('2026-04-20'),
            startTime: '16:00',
            endTime: '17:00',
          }),
        }),
      );
    });

    it('يجب أن يرفض التحديث على موعد مكتمل', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'completed',
        totalDuration: 60,
      });

      await expect(
        service.update(
          mockDb as unknown as TenantPrismaClient,
          'app-1',
          { date: '2026-04-20', startTime: '16:00' },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.appointment.update).not.toHaveBeenCalled();
    });

    it('يجب أن يرمي NotFoundException عند عدم وجود الموعد', async () => {
      mockDb.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          mockDb as unknown as TenantPrismaClient,
          'nonexistent',
          { date: '2026-04-20' },
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockDb.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('يجب أن يفوض إلى changeStatus مع حالة cancelled', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'confirmed',
        clientId: 'client-1',
        totalPrice: 100,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        status: 'cancelled',
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: mockDb.appointment,
            client: mockDb.client,
          };
          return fn(tx);
        },
      );

      const result = await service.cancel(
        mockDb as unknown as TenantPrismaClient,
        'app-1',
      );

      expect(result).toHaveProperty('status', 'cancelled');
      expect(mockDb.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cancelled',
            cancellationReason: 'تم الإلغاء بواسطة المستخدم',
          }),
        }),
      );
    });

    it('يجب أن يضبط سبب الإلغاء الافتراضي', async () => {
      mockDb.appointment.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'pending',
        clientId: 'client-1',
        totalPrice: 100,
      });
      mockDb.appointment.update.mockResolvedValue({
        id: 'app-1',
        status: 'cancelled',
        cancellationReason: 'تم الإلغاء بواسطة المستخدم',
      });
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) => {
          const tx = {
            ...mockDb,
            appointment: mockDb.appointment,
            client: mockDb.client,
          };
          return fn(tx);
        },
      );

      await service.cancel(mockDb as unknown as TenantPrismaClient, 'app-1');

      expect(mockDb.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancellationReason: 'تم الإلغاء بواسطة المستخدم',
          }),
        }),
      );
    });
  });
});
