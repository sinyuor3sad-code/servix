import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { SetServicesDto } from './dto/set-services.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

@Injectable()
export class EmployeesService {
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
    const limit = query.limit ?? query.perPage;
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

    return {
      items: employees.map((e) => this.mapDecimalFields(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
        role: dto.role as 'stylist' | 'manager' | 'receptionist' | 'cashier',
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
        | 'manager'
        | 'receptionist'
        | 'cashier';
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

    const employee = await db.employee.update({
      where: { id },
      data: { isActive: false },
    });

    return this.mapDecimalFields(employee);
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
}
