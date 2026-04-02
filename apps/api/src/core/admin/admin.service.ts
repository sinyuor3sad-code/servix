import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type {
  Tenant,
  Subscription,
  Plan,
  PlatformInvoice,
  PlatformAuditLog,
  User,
  TenantUser,
  TenantFeature,
  Feature,
  PlanFeature,
} from '../../shared/database';
import {
  GetTenantsDto,
  GetSubscriptionsDto,
  GetInvoicesDto,
  GetAuditLogsDto,
} from './admin.dto';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

interface PlanDistribution {
  planId: string;
  planName: string;
  planNameAr: string;
  count: number;
}

interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRevenue: number;
  revenueThisMonth: number;
  newTenantsThisMonth: number;
  planDistribution: PlanDistribution[];
}

type TenantWithSubscription = Tenant & {
  subscriptions: (Subscription & { plan: Plan })[];
};

type TenantWithDetails = Tenant & {
  tenantUsers: (TenantUser & { user: User })[];
  subscriptions: (Subscription & {
    plan: Plan & { planFeatures: (PlanFeature & { feature: Feature })[] };
  })[];
  tenantFeatures: (TenantFeature & { feature: Feature })[];
  auditLogs: (PlatformAuditLog & { user: User })[];
};

type SubscriptionWithRelations = Subscription & {
  tenant: Tenant;
  plan: Plan;
};

type InvoiceWithRelations = PlatformInvoice & {
  tenant: Tenant;
  subscription: Subscription & { plan: Plan };
};

type AuditLogWithUser = PlatformAuditLog & {
  user: User;
};

interface AdminLoginResult {
  user: { id: string; email: string; fullName: string; role: string };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<AdminLoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // Check that this user has super_admin role
    const superAdminRole = await this.prisma.role.findUnique({
      where: { name: 'super_admin' },
    });

    if (!superAdminRole) {
      throw new UnauthorizedException('ليس لديك صلاحية الدخول لوحة الإدارة');
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: {
        userId: user.id,
        roleId: superAdminRole.id,
        status: 'active',
      },
    });

    if (!tenantUser) {
      throw new UnauthorizedException('ليس لديك صلاحية الدخول لوحة الإدارة');
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: tenantUser.tenantId,
      roleId: superAdminRole.id,
    };

    const accessSecret = this.configService.get<string>('jwt.accessSecret', '');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret', '');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: accessSecret,
        expiresIn: '1d',
      }),
      this.jwtService.signAsync(tokenPayload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: 'super_admin',
      },
      accessToken,
      refreshToken,
    };
  }

  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalSubscriptions,
      activeSubscriptions,
      revenueResult,
      revenueThisMonthResult,
      newTenantsThisMonth,
      planDistributionRaw,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.count({ where: { status: 'suspended' } }),
      this.prisma.user.count(),
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.platformInvoice.aggregate({
        where: { status: 'paid' },
        _sum: { total: true },
      }),
      this.prisma.platformInvoice.aggregate({
        where: {
          status: 'paid',
          paidAt: { gte: startOfMonth },
        },
        _sum: { total: true },
      }),
      this.prisma.tenant.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.subscription.groupBy({
        by: ['planId'],
        _count: { id: true },
        where: { status: 'active' },
      }),
    ]);

    const planIds = planDistributionRaw.map((item) => item.planId);
    const plans = await this.prisma.plan.findMany({
      where: { id: { in: planIds } },
    });

    const plansMap = new Map(plans.map((p) => [p.id, p]));

    const planDistribution: PlanDistribution[] = planDistributionRaw.map((item) => {
      const plan = plansMap.get(item.planId);
      return {
        planId: item.planId,
        planName: plan?.name ?? '',
        planNameAr: plan?.nameAr ?? '',
        count: item._count.id,
      };
    });

    return {
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalSubscriptions,
      activeSubscriptions,
      totalRevenue: Number(revenueResult._sum.total ?? 0),
      revenueThisMonth: Number(revenueThisMonthResult._sum.total ?? 0),
      newTenantsThisMonth,
      planDistribution,
    };
  }

  async getTenants(dto: GetTenantsDto): Promise<PaginatedResult<TenantWithSubscription>> {
    const { page = 1, perPage = 20, search, status } = dto;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { nameAr: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.tenant.count({ where }),
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

  async getTenantById(id: string): Promise<TenantWithDetails> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        tenantUsers: {
          include: { user: true },
        },
        subscriptions: {
          include: {
            plan: {
              include: {
                planFeatures: {
                  include: { feature: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        tenantFeatures: {
          include: { feature: true },
        },
        auditLogs: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    return tenant;
  }

  async updateTenantStatus(
    tenantId: string,
    status: 'active' | 'suspended',
    userId: string,
  ): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    if (tenant.status === status) {
      const statusAr = status === 'active' ? 'مفعّلة' : 'معلّقة';
      throw new BadRequestException(`المنشأة ${statusAr} بالفعل`);
    }

    const oldStatus = tenant.status;

    const [updatedTenant] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status },
      }),
      this.prisma.platformAuditLog.create({
        data: {
          userId,
          tenantId,
          action: 'update_status',
          entityType: 'tenant',
          entityId: tenantId,
          oldValues: { status: oldStatus },
          newValues: { status },
        },
      }),
    ]);

    return updatedTenant;
  }

  async getSubscriptions(
    dto: GetSubscriptionsDto,
  ): Promise<PaginatedResult<SubscriptionWithRelations>> {
    const { page = 1, perPage = 20, status, planId } = dto;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (planId) {
      where.planId = planId;
    }

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          tenant: true,
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.subscription.count({ where }),
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

  async getInvoices(dto: GetInvoicesDto): Promise<PaginatedResult<InvoiceWithRelations>> {
    const { page = 1, perPage = 20, status } = dto;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.platformInvoice.findMany({
        where,
        include: {
          tenant: true,
          subscription: {
            include: { plan: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.platformInvoice.count({ where }),
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

  async getAuditLogs(dto: GetAuditLogsDto): Promise<PaginatedResult<AuditLogWithUser>> {
    const { page = 1, perPage = 20, userId, entityType, action } = dto;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (action) {
      where.action = action;
    }

    const [data, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.platformAuditLog.count({ where }),
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
}
