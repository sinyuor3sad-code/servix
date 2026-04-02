import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

interface ClientStats {
  totalClients: number;
  newThisMonth: number;
  totalVisitsThisMonth: number;
  avgSpend: number;
}

@Injectable()
export class ClientsService {
  async findAll(
    db: TenantPrismaClient,
    query: QueryClientsDto,
  ) {
    const { page, sort, order, search, gender, source, isActive } = query;
    const limit = (query as any).limit ?? query.perPage;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender) {
      where.gender = gender;
    }

    if (source) {
      where.source = source;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      db.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
      }),
      db.client.count({ where }),
    ]);

    return {
      items: data as unknown as Record<string, unknown>[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateClientDto,
  ): Promise<Record<string, unknown>> {
    const client = await db.client.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        notes: dto.notes,
        source: dto.source,
      },
    });

    return client as unknown as Record<string, unknown>;
  }

  async findOne(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const client = await db.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        loyaltyPoints: true,
      },
    });

    if (!client) {
      throw new NotFoundException('العميل غير موجود');
    }

    return client as unknown as Record<string, unknown>;
  }

  async update(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateClientDto,
  ): Promise<Record<string, unknown>> {
    await this.findOne(db, id);

    const client = await db.client.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });

    return client as unknown as Record<string, unknown>;
  }

  async softDelete(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    await this.findOne(db, id);

    const client = await db.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return client as unknown as Record<string, unknown>;
  }

  async getHistory(
    db: TenantPrismaClient,
    clientId: string,
  ): Promise<Record<string, unknown>[]> {
    await this.findOne(db, clientId);

    const appointments = await db.appointment.findMany({
      where: { clientId },
      include: {
        appointmentServices: {
          include: {
            service: true,
            employee: true,
          },
        },
        employee: true,
      },
      orderBy: { date: 'desc' },
    });

    return appointments as unknown as Record<string, unknown>[];
  }

  async getLoyalty(
    db: TenantPrismaClient,
    clientId: string,
  ): Promise<Record<string, unknown>> {
    await this.findOne(db, clientId);

    const [loyaltyPoints, recentTransactions] = await Promise.all([
      db.loyaltyPoints.findUnique({
        where: { clientId },
      }),
      db.loyaltyTransaction.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      points: loyaltyPoints?.points ?? 0,
      lifetimePoints: loyaltyPoints?.lifetimePoints ?? 0,
      transactions: recentTransactions,
    };
  }

  async search(
    db: TenantPrismaClient,
    query: string,
  ): Promise<Record<string, unknown>[]> {
    const clients = await db.client.findMany({
      where: {
        deletedAt: null,
        OR: [
          { fullName: { startsWith: query, mode: 'insensitive' } },
          { phone: { startsWith: query } },
        ],
      },
      take: 20,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        gender: true,
        isActive: true,
      },
    });

    return clients as unknown as Record<string, unknown>[];
  }

  async getStats(db: TenantPrismaClient): Promise<ClientStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalClients, newThisMonth, visitsThisMonth, avgSpendResult] =
      await Promise.all([
        db.client.count({ where: { deletedAt: null } }),
        db.client.count({
          where: {
            deletedAt: null,
            createdAt: { gte: startOfMonth },
          },
        }),
        db.appointment.count({
          where: {
            date: { gte: startOfMonth },
            status: 'completed',
          },
        }),
        db.client.aggregate({
          where: { deletedAt: null, totalSpent: { gt: 0 } },
          _avg: { totalSpent: true },
        }),
      ]);

    return {
      totalClients,
      newThisMonth,
      totalVisitsThisMonth: visitsThisMonth,
      avgSpend: Number(avgSpendResult._avg.totalSpent ?? 0),
    };
  }
}
