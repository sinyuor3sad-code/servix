import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { TenantPrismaClient } from '../../../shared/types';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { SetServicesDto } from './dto/set-services.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { CreateEmployeeAccountDto } from './dto/create-employee-account.dto';
import { paginate, effectiveLimit } from '../../../shared/helpers/paginate.helper';

const BCRYPT_ROUNDS = 12;


@Injectable()
export class EmployeesService {
  constructor(private readonly platformPrisma: PlatformPrismaClient) {}
  private mapDecimalFields<
    T extends {
      commissionValue: { toNumber?: () => number } | number;
    },
  >(employee: T): T & { commissionValue: number } {
    return {
      ...employee,
      commissionValue:
        typeof employee.commissionValue === 'number'
          ? employee.commissionValue
          : Number(employee.commissionValue),
    };
  }

  private async findEmployeeOrFail(
    db: TenantPrismaClient,
    id: string,
  ): Promise<{ id: string }> {
    const employee = await db.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود');
    }
    return employee;
  }

  async findAll(
    db: TenantPrismaClient,
    query: QueryEmployeesDto,
  ) {
    const { page, role, isActive, search } = query;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) where.fullName = { contains: search, mode: 'insensitive' };

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.employee.count({ where }),
    ]);

    return paginate(
      employees.map((e) => this.mapDecimalFields(e)) as unknown as Record<string, unknown>[],
      total, page, limit,
    );
  }

  async findOne(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        employeeServices: { include: { service: true } },
        employeeSchedules: { orderBy: { dayOfWeek: 'asc' } },
      },
    });

    if (!employee) {
      throw new NotFoundException('الموظف غير موجود');
    }

    return this.mapDecimalFields(employee);
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateEmployeeDto,
  ): Promise<Record<string, unknown>> {
    const employee = await db.employee.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        role: dto.role as 'stylist' | 'cashier' | 'makeup' | 'nails' | 'skincare',
        commissionType: dto.commissionType as
          | 'percentage'
          | 'fixed'
          | 'none',
        commissionValue: dto.commissionValue ?? 0,
      },
    });

    return this.mapDecimalFields(employee);
  }

  async update(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<Record<string, unknown>> {
    await this.findEmployeeOrFail(db, id);

    const data: Record<string, unknown> = { ...dto };
    if (dto.role) {
      data.role = dto.role as
        | 'stylist'
        | 'cashier'
        | 'makeup'
        | 'nails'
        | 'skincare';
    }
    if (dto.commissionType) {
      data.commissionType = dto.commissionType as
        | 'percentage'
        | 'fixed'
        | 'none';
    }

    const employee = await db.employee.update({
      where: { id },
      data,
    });

    return this.mapDecimalFields(employee);
  }

  async deactivate(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    await this.findEmployeeOrFail(db, id);

    try {
      // Try actual delete first
      await db.employee.delete({ where: { id } });
      return { id, deleted: true };
    } catch {
      // If FK constraints prevent deletion, deactivate instead
      await db.employee.update({
        where: { id },
        data: { isActive: false },
      });
      return { id, deactivated: true };
    }
  }

  // ─── Schedule Management ───

  async getSchedule(
    db: TenantPrismaClient,
    employeeId: string,
  ): Promise<Record<string, unknown>[]> {
    await this.findEmployeeOrFail(db, employeeId);

    return db.employeeSchedule.findMany({
      where: { employeeId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setSchedule(
    db: TenantPrismaClient,
    employeeId: string,
    dto: SetScheduleDto,
  ): Promise<Record<string, unknown>[]> {
    await this.findEmployeeOrFail(db, employeeId);

    const operations = dto.schedules.map((day) =>
      db.employeeSchedule.upsert({
        where: {
          employeeId_dayOfWeek: {
            employeeId,
            dayOfWeek: day.dayOfWeek,
          },
        },
        create: {
          employeeId,
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          isDayOff: day.isDayOff,
        },
        update: {
          startTime: day.startTime,
          endTime: day.endTime,
          isDayOff: day.isDayOff,
        },
      }),
    );

    await db.$transaction(operations);

    return db.employeeSchedule.findMany({
      where: { employeeId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ─── Service Assignment ───

  async getAssignedServices(
    db: TenantPrismaClient,
    employeeId: string,
  ): Promise<Record<string, unknown>[]> {
    await this.findEmployeeOrFail(db, employeeId);

    const assignments = await db.employeeService.findMany({
      where: { employeeId },
      include: { service: { include: { category: true } } },
    });

    return assignments.map((a) => ({
      ...a,
      service: {
        ...a.service,
        price: Number(a.service.price),
      },
    }));
  }

  async setAssignedServices(
    db: TenantPrismaClient,
    employeeId: string,
    dto: SetServicesDto,
  ): Promise<Record<string, unknown>[]> {
    await this.findEmployeeOrFail(db, employeeId);

    await db.$transaction([
      db.employeeService.deleteMany({ where: { employeeId } }),
      ...dto.serviceIds.map((serviceId) =>
        db.employeeService.create({
          data: { employeeId, serviceId },
        }),
      ),
    ]);

    const assignments = await db.employeeService.findMany({
      where: { employeeId },
      include: { service: { include: { category: true } } },
    });

    return assignments.map((a) => ({
      ...a,
      service: {
        ...a.service,
        price: Number(a.service.price),
      },
    }));
  }

  // ─── Account Management ───

  /**
   * Create a login account (User + TenantUser) for an existing employee.
   * This allows the employee to log in to the dashboard with their assigned role.
   */
  async createAccount(
    db: TenantPrismaClient,
    tenantId: string,
    employeeId: string,
    dto: CreateEmployeeAccountDto,
  ): Promise<{ message: string; userId: string }> {
    // 1. Verify the employee exists
    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود');
    }

    // 2. Check if email is already taken
    const existingUser = await this.platformPrisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('البريد الإلكتروني مسجل مسبقاً');
    }

    // 3. Map employee role to platform role name
    const roleMap: Record<string, string> = {
      stylist: 'staff',
      cashier: 'cashier',
      makeup: 'staff',
      nails: 'staff',
      skincare: 'staff',
    };
    const platformRoleName = roleMap[employee.role] || 'staff';

    // 4. Find the role in the platform DB
    const role = await this.platformPrisma.role.findUnique({
      where: { name: platformRoleName },
    });
    if (!role) {
      throw new InternalServerErrorException(`الدور ${platformRoleName} غير موجود في النظام`);
    }

    // 5. Create user + tenant-user in a transaction
    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    const result = await this.platformPrisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: employee.fullName,
          email: dto.email,
          phone: employee.phone ?? '',
          passwordHash,
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId,
          userId: user.id,
          roleId: role.id,
          isOwner: false,
        },
      });

      return user;
    });

    // 6. Update employee record with the email
    await db.employee.update({
      where: { id: employeeId },
      data: { email: dto.email },
    });

    return {
      message: `تم إنشاء حساب الدخول بنجاح لـ ${employee.fullName}`,
      userId: result.id,
    };
  }
}
