import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type { User, TenantUser, Tenant, Role } from '../../shared/database';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type UserWithTenants = User & {
  tenantUsers: (TenantUser & {
    tenant: Pick<Tenant, 'id' | 'nameAr' | 'nameEn' | 'slug'>;
    role: Pick<Role, 'id' | 'name' | 'nameAr'>;
  })[];
};

interface PaginatedUsers {
  data: User[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PlatformPrismaClient) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedUsers> {
    const { page, perPage, sort, order, search, status } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.tenantUsers = {
        some: {
          status: status,
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(id: string): Promise<UserWithTenants> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenantUsers: {
          include: {
            tenant: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
            role: { select: { id: true, name: true, nameAr: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
      }
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('رقم الجوال مستخدم بالفعل');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenantUsers: true },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    if (user.tenantUsers.length > 0) {
      await this.prisma.tenantUser.updateMany({
        where: { userId: id },
        data: { status: 'inactive' },
      });
    }

    return user;
  }
}
