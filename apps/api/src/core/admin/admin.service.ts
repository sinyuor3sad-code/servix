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
import { PlatformSettingsService } from '../../shared/database/platform-settings.service';
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
  GetNotificationsDto,
  CreateNotificationDto,
  GetCouponsDto,
  CreateCouponDto,
  UpdateCouponDto,
  GetPaymentsDto,
  GetRenewalsDto,
  UpdateSubscriptionDto,
  ExtendTrialDto,
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
    private readonly platformSettings: PlatformSettingsService,
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

    // Read session_duration from admin settings (minutes), default 1440 (1 day)
    const sessionMinutes = await this.platformSettings.getNumber('session_duration', 1440);
    const accessExpirySeconds = sessionMinutes * 60;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: accessSecret,
        expiresIn: accessExpirySeconds,
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

  async getStats(): Promise<AdminStats & { pendingTenants: number; recentTenants: Tenant[] }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      pendingTenants,
      totalUsers,
      totalSubscriptions,
      activeSubscriptions,
      revenueResult,
      revenueThisMonthResult,
      newTenantsThisMonth,
      planDistributionRaw,
      recentTenants,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.count({ where: { status: 'suspended' } }),
      this.prisma.tenant.count({ where: { status: 'trial' } }),
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
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
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
      pendingTenants,
      totalUsers,
      totalSubscriptions,
      activeSubscriptions,
      totalRevenue: Number(revenueResult._sum.total ?? 0),
      revenueThisMonth: Number(revenueThisMonthResult._sum.total ?? 0),
      newTenantsThisMonth,
      planDistribution,
      recentTenants,
    };
  }

  // ═══════════════════ Users ═══════════════════

  async getUsers(opts: {
    page: number;
    perPage: number;
    search: string;
    verified?: boolean;
  }) {
    const { page, perPage, search, verified } = opts;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (verified !== undefined) {
      where.isEmailVerified = verified;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          authProvider: true,
          lastLoginAt: true,
          createdAt: true,
          tenantUsers: {
            select: {
              isOwner: true,
              tenant: {
                select: { id: true, nameAr: true, nameEn: true, slug: true },
              },
              role: {
                select: { name: true, nameAr: true },
              },
            },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
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
    const { page = 1, perPage = 20, status, search } = dto;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { tenant: { nameAr: { contains: search, mode: 'insensitive' } } },
        { tenant: { nameEn: { contains: search, mode: 'insensitive' } } },
      ];
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

  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      include: {
        planFeatures: {
          include: { feature: true },
        },
        _count: {
          select: {
            subscriptions: {
              where: { status: 'active' },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return plans.map((p) => ({
      ...p,
      activeSubscriptions: p._count.subscriptions,
      _count: undefined,
    }));
  }

  // ═══════════════════ Token Refresh ═══════════════════

  async refreshToken(refreshToken: string): Promise<AdminLoginResult> {
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret', '');

    let payload: { sub: string; email: string; tenantId: string; roleId: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('المستخدم غير موجود');

    const superAdminRole = await this.prisma.role.findUnique({ where: { name: 'super_admin' } });
    if (!superAdminRole) throw new UnauthorizedException('ليس لديك صلاحية');

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, roleId: superAdminRole.id, status: 'active' },
    });
    if (!tenantUser) throw new UnauthorizedException('ليس لديك صلاحية');

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: tenantUser.tenantId,
      roleId: superAdminRole.id,
    };

    const accessSecret = this.configService.get<string>('jwt.accessSecret', '');

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, { secret: accessSecret, expiresIn: '1d' }),
      this.jwtService.signAsync(tokenPayload, { secret: refreshSecret, expiresIn: '7d' }),
    ]);

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: 'super_admin' },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ═══════════════════ Platform Settings ═══════════════════

  async getSettings(): Promise<Record<string, string>> {
    const settings = await this.prisma.platformSetting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async updateSettings(settings: Record<string, string>, userId: string): Promise<Record<string, string>> {
    const entries = Object.entries(settings);
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );

    await this.prisma.platformAuditLog.create({
      data: {
        userId,
        action: 'update_settings',
        entityType: 'platform_settings',
        entityId: userId,
        newValues: settings,
      },
    });

    // Invalidate cached settings so all runtime consumers see new values immediately
    await this.platformSettings.invalidateCache();

    return this.getSettings();
  }

  // ═══════════════════ Backups ═══════════════════

  async getBackups(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};
    const backups = await this.prisma.platformBackup.findMany({
      where,
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return backups;
  }

  async getBackupsByTenant() {
    // Get all tenants with their latest backup
    const tenants = await this.prisma.tenant.findMany({
      include: {
        backups: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => {
      const lastBackup = t.backups[0] ?? null;
      return {
        id: t.id,
        salonName: t.nameAr || t.nameEn || t.slug,
        lastBackup: lastBackup?.finishedAt?.toISOString() ?? null,
        status: lastBackup?.status ?? 'never',
        size: lastBackup?.sizeBytes ? `${Math.round(Number(lastBackup.sizeBytes) / (1024 * 1024))} MB` : '—',
        initiator: lastBackup?.initiator ?? '—',
        autoBackup: false, // TODO: read from settings per tenant
      };
    });
  }

  async triggerBackup(tenantId: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('المنشأة غير موجودة');

    const backup = await this.prisma.platformBackup.create({
      data: {
        tenantId,
        status: 'pending',
        initiator: 'manual',
      },
    });

    // Simulate backup completion (in production this would be a BullMQ job)
    // For now mark as success after creating record
    const sizeBytes = BigInt(Math.floor(Math.random() * 100_000_000) + 10_000_000);
    const updatedBackup = await this.prisma.platformBackup.update({
      where: { id: backup.id },
      data: {
        status: 'success',
        sizeBytes,
        finishedAt: new Date(),
        filePath: `backups/${tenant.databaseName}/${backup.id}.sql.gz`,
      },
      include: { tenant: true },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        userId,
        tenantId,
        action: 'trigger_backup',
        entityType: 'backup',
        entityId: backup.id,
      },
    });

    return {
      id: updatedBackup.id,
      salonName: tenant.nameAr,
      lastBackup: updatedBackup.finishedAt?.toISOString(),
      status: updatedBackup.status,
      size: `${Math.round(Number(sizeBytes) / (1024 * 1024))} MB`,
      initiator: 'يدوي (المدير)',
    };
  }

  // ═══════════════════ Platform Notifications ═══════════════════

  async getNotifications(dto: GetNotificationsDto) {
    const { page = 1, perPage = 20, status } = dto;
    const skip = (page - 1) * perPage;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.platformNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.platformNotification.count({ where }),
    ]);

    return {
      data,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async createNotification(dto: CreateNotificationDto, userId: string) {
    const status = dto.saveAsDraft ? 'draft' : 'sent';

    // Count recipients based on target
    let recipients = 0;
    if (!dto.saveAsDraft) {
      const targetFilter = this.getTargetFilter(dto.target);
      recipients = await this.prisma.tenant.count({ where: targetFilter });
    }

    const notification = await this.prisma.platformNotification.create({
      data: {
        title: dto.title,
        body: dto.body,
        channel: dto.channel,
        target: dto.target,
        status,
        recipients,
        delivered: dto.saveAsDraft ? 0 : recipients,
        sentAt: dto.saveAsDraft ? null : new Date(),
        createdBy: userId,
      },
    });

    return notification;
  }

  private getTargetFilter(target: string): Record<string, unknown> {
    switch (target) {
      case 'basic':
        return { subscriptions: { some: { plan: { name: 'basic' }, status: 'active' } } };
      case 'pro':
        return { subscriptions: { some: { plan: { name: 'pro' }, status: 'active' } } };
      case 'enterprise':
        return { subscriptions: { some: { plan: { name: 'enterprise' }, status: 'active' } } };
      case 'trial':
        return { status: 'trial' };
      case 'expiring': {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return {
          subscriptions: {
            some: {
              status: 'active',
              currentPeriodEnd: { lte: sevenDaysFromNow },
            },
          },
        };
      }
      default:
        return {};
    }
  }

  // ═══════════════════ Platform Coupons ═══════════════════

  async getCoupons(dto: GetCouponsDto) {
    const { page = 1, perPage = 20 } = dto;
    const skip = (page - 1) * perPage;

    const [data, total] = await Promise.all([
      this.prisma.platformCoupon.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.platformCoupon.count(),
    ]);

    return {
      data,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async createCoupon(dto: CreateCouponDto) {
    const existing = await this.prisma.platformCoupon.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new BadRequestException('كود الكوبون مستخدم بالفعل');

    return this.prisma.platformCoupon.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type as 'percentage' | 'fixed' | 'free',
        value: dto.value,
        usageLimit: dto.usageLimit ?? 0,
        validUntil: new Date(dto.validUntil),
      },
    });
  }

  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.platformCoupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('الكوبون غير موجود');

    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data.code = dto.code.toUpperCase();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.validUntil !== undefined) data.validUntil = new Date(dto.validUntil);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.platformCoupon.update({ where: { id }, data });
  }

  async deleteCoupon(id: string) {
    const coupon = await this.prisma.platformCoupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('الكوبون غير موجود');
    await this.prisma.platformCoupon.delete({ where: { id } });
    return { deleted: true };
  }

  // ═══════════════════ Payments (view on PlatformInvoice) ═══════════════════

  async getPayments(dto: GetPaymentsDto) {
    const { page = 1, perPage = 20, status, search } = dto;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { tenant: { nameAr: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.platformInvoice.findMany({
        where,
        include: {
          tenant: true,
          subscription: { include: { plan: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.platformInvoice.count({ where }),
    ]);

    return {
      data: data.map((inv) => ({
        id: inv.invoiceNumber,
        salon: inv.tenant.nameAr || inv.tenant.nameEn,
        amount: Number(inv.total),
        method: '—', // Payment method not tracked yet
        status: inv.status === 'paid' ? 'completed' : inv.status === 'pending' ? 'pending' : 'failed',
        date: (inv.paidAt ?? inv.createdAt).toISOString().slice(0, 10),
      })),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  // ═══════════════════ Renewals (view on Subscriptions) ═══════════════════

  async getRenewals(dto: GetRenewalsDto) {
    const { page = 1, perPage = 20 } = dto;
    const skip = (page - 1) * perPage;

    // Renewals = subscriptions ordered by updatedAt (recently modified)
    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        include: {
          tenant: true,
          plan: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.subscription.count(),
    ]);

    return {
      data: data.map((sub) => ({
        id: sub.id,
        salon: sub.tenant.nameAr || sub.tenant.nameEn,
        planName: sub.plan.nameAr || sub.plan.name,
        amount: Number(sub.billingCycle === 'yearly' ? sub.plan.priceYearly : sub.plan.priceMonthly),
        status: sub.status === 'active' ? 'renewed' : sub.status === 'expired' ? 'failed' : 'pending',
        date: sub.currentPeriodEnd.toISOString().slice(0, 10),
        billingCycle: sub.billingCycle,
      })),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async updatePlan(
    id: string,
    dto: Record<string, unknown>,
    userId: string,
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('الباقة غير موجودة');
    }

    // Only allow updating specific fields
    const allowedFields = [
      'nameAr', 'name', 'nameEn', 'slug', 'priceMonthly', 'priceYearly',
      'maxEmployees', 'maxClients', 'maxAppointmentsMonth',
      'revenueSharePercent', 'perAppointmentFee', 'includedAppointments',
      'descriptionAr', 'trialDays', 'isActive', 'sortOrder',
      'badge', 'isPublic', 'isInternal', 'setupFee',
      'trialEnabled', 'upgradeAllowed', 'downgradeAllowed', 'metadata',
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in dto) {
        updateData[key] = dto[key];
      }
    }

    const [updatedPlan] = await this.prisma.$transaction([
      this.prisma.plan.update({
        where: { id },
        data: updateData,
        include: {
          planFeatures: {
            include: { feature: true },
          },
        },
      }),
      this.prisma.platformAuditLog.create({
        data: {
          userId,
          action: 'update_plan',
          entityType: 'plan',
          entityId: id,
          oldValues: JSON.parse(JSON.stringify(plan)),
          newValues: JSON.parse(JSON.stringify(updateData)),
        },
      }),
    ]);

    return updatedPlan;
  }

  // ═══════════════════ Plan Catalog Management ═══════════════════

  async createPlan(dto: Record<string, unknown>, userId: string) {
    const data: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'nameAr', 'nameEn', 'slug', 'priceMonthly', 'priceYearly',
      'maxEmployees', 'maxClients', 'maxAppointmentsMonth',
      'revenueSharePercent', 'perAppointmentFee', 'includedAppointments',
      'descriptionAr', 'trialDays', 'isActive', 'sortOrder',
      'badge', 'isPublic', 'isInternal', 'setupFee',
      'trialEnabled', 'upgradeAllowed', 'downgradeAllowed', 'metadata',
    ];
    for (const key of allowedFields) {
      if (key in dto) data[key] = dto[key];
    }

    if (!data.name || !data.nameAr) {
      throw new BadRequestException('اسم الباقة مطلوب بالعربي والإنجليزي');
    }

    const plan = await this.prisma.plan.create({
      data: data as any,
      include: { planFeatures: { include: { feature: true } } },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        userId,
        action: 'create_plan',
        entityType: 'plan',
        entityId: plan.id,
        newValues: JSON.parse(JSON.stringify(data)),
      },
    });

    return plan;
  }

  async updatePlanFeatures(
    planId: string,
    featureIds: string[],
    userId: string,
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('الباقة غير موجودة');

    const oldFeatures = await this.prisma.planFeature.findMany({
      where: { planId },
      include: { feature: true },
    });

    // Delete all existing and replace
    await this.prisma.$transaction([
      this.prisma.planFeature.deleteMany({ where: { planId } }),
      ...featureIds.map(featureId =>
        this.prisma.planFeature.create({
          data: { planId, featureId },
        }),
      ),
      this.prisma.platformAuditLog.create({
        data: {
          userId,
          action: 'update_plan_features',
          entityType: 'plan',
          entityId: planId,
          oldValues: { features: oldFeatures.map(f => f.feature.code) },
          newValues: { featureIds },
        },
      }),
    ]);

    return this.prisma.planFeature.findMany({
      where: { planId },
      include: { feature: true },
    });
  }

  async duplicatePlan(planId: string, userId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { planFeatures: true },
    });
    if (!plan) throw new NotFoundException('الباقة غير موجودة');

    const { id, createdAt, updatedAt, slug, ...planData } = plan as any;
    const newPlan = await this.prisma.plan.create({
      data: {
        ...planData,
        name: `${plan.name}_copy`,
        nameAr: `${plan.nameAr} (نسخة)`,
        slug: null,
        planFeatures: undefined,
        subscriptions: undefined,
      },
      include: { planFeatures: { include: { feature: true } } },
    });

    // Copy features
    if (plan.planFeatures.length > 0) {
      await this.prisma.planFeature.createMany({
        data: plan.planFeatures.map(pf => ({
          planId: newPlan.id,
          featureId: pf.featureId,
          limitValue: pf.limitValue,
          isIncluded: pf.isIncluded,
        })),
      });
    }

    await this.prisma.platformAuditLog.create({
      data: {
        userId,
        action: 'duplicate_plan',
        entityType: 'plan',
        entityId: newPlan.id,
        newValues: { sourcePlanId: planId, newPlanId: newPlan.id },
      },
    });

    return this.prisma.plan.findUnique({
      where: { id: newPlan.id },
      include: { planFeatures: { include: { feature: true } } },
    });
  }

  // ═══════════════════ Feature Catalog ═══════════════════

  async getFeatureCatalog() {
    return this.prisma.feature.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        planFeatures: {
          select: { planId: true },
        },
      },
    });
  }

  // ═══════════════════ Add-ons ═══════════════════

  async getAddons() {
    return this.prisma.planAddon.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { feature: true },
    });
  }

  async createAddon(dto: Record<string, unknown>, userId: string) {
    const addon = await this.prisma.planAddon.create({
      data: dto as any,
      include: { feature: true },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        userId,
        action: 'create_addon',
        entityType: 'plan_addon',
        entityId: addon.id,
        newValues: JSON.parse(JSON.stringify(dto)),
      },
    });

    return addon;
  }

  async updateAddon(id: string, dto: Record<string, unknown>, userId: string) {
    const addon = await this.prisma.planAddon.findUnique({ where: { id } });
    if (!addon) throw new NotFoundException('الإضافة غير موجودة');

    const updated = await this.prisma.planAddon.update({
      where: { id },
      data: dto as any,
      include: { feature: true },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        userId,
        action: 'update_addon',
        entityType: 'plan_addon',
        entityId: id,
        oldValues: JSON.parse(JSON.stringify(addon)),
        newValues: JSON.parse(JSON.stringify(dto)),
      },
    });

    return updated;
  }

  // ═══════════════════ Tenant Feature Overrides ═══════════════════

  async getTenantOverrides(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('المنشأة غير موجودة');

    return this.prisma.tenantFeature.findMany({
      where: { tenantId },
      include: { feature: true },
    });
  }

  async setTenantOverrides(
    tenantId: string,
    overrides: { featureId: string; isEnabled: boolean }[],
    userId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('المنشأة غير موجودة');

    const oldOverrides = await this.prisma.tenantFeature.findMany({
      where: { tenantId },
      include: { feature: true },
    });

    // Upsert all overrides
    const ops = overrides.map(o =>
      this.prisma.tenantFeature.upsert({
        where: { tenantId_featureId: { tenantId, featureId: o.featureId } },
        create: {
          tenantId,
          featureId: o.featureId,
          isEnabled: o.isEnabled,
          ...(o.isEnabled ? {} : { disabledAt: new Date() }),
        },
        update: {
          isEnabled: o.isEnabled,
          ...(o.isEnabled ? { disabledAt: null } : { disabledAt: new Date() }),
        },
      }),
    );

    await this.prisma.$transaction([
      ...ops,
      this.prisma.platformAuditLog.create({
        data: {
          userId,
          tenantId,
          action: 'set_tenant_overrides',
          entityType: 'tenant',
          entityId: tenantId,
          oldValues: { overrides: oldOverrides.map(o => ({ featureId: o.featureId, isEnabled: o.isEnabled })) },
          newValues: { overrides },
        },
      }),
    ]);

    return this.prisma.tenantFeature.findMany({
      where: { tenantId },
      include: { feature: true },
    });
  }

  // ═══════════════════ Subscription Management ═══════════════════

  async getSubscriptionById(id: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        tenant: true,
        plan: {
          include: {
            planFeatures: { include: { feature: true } },
          },
        },
        platformInvoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!sub) {
      throw new NotFoundException('الاشتراك غير موجود');
    }

    // Fetch audit logs for this subscription
    const auditLogs = await this.prisma.platformAuditLog.findMany({
      where: {
        entityType: 'subscription',
        entityId: id,
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Also get all plans for plan-change UI
    const allPlans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return { ...sub, auditLogs, allPlans };
  }

  async updateSubscription(
    id: string,
    dto: UpdateSubscriptionDto,
    userId: string,
  ) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, tenant: true },
    });

    if (!sub) {
      throw new NotFoundException('الاشتراك غير موجود');
    }

    const oldValues: Record<string, unknown> = {
      status: sub.status,
      planId: sub.planId,
      billingCycle: sub.billingCycle,
      currentPeriodEnd: sub.currentPeriodEnd,
    };

    const updateData: Record<string, unknown> = {};

    if (dto.status && dto.status !== sub.status) {
      updateData.status = dto.status;
      if (dto.status === 'cancelled') {
        updateData.cancelledAt = new Date();
      }
      if (dto.status === 'active' && sub.status === 'cancelled') {
        updateData.cancelledAt = null;
      }
    }

    if (dto.planId && dto.planId !== sub.planId) {
      // Verify the new plan exists
      const newPlan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!newPlan) throw new NotFoundException('الباقة الجديدة غير موجودة');
      updateData.planId = dto.planId;
    }

    if (dto.billingCycle && dto.billingCycle !== sub.billingCycle) {
      updateData.billingCycle = dto.billingCycle;
    }

    if (dto.currentPeriodEnd) {
      updateData.currentPeriodEnd = new Date(dto.currentPeriodEnd);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('لم يتم تقديم أي تعديلات');
    }

    const newValues: Record<string, unknown> = { ...updateData };
    if (dto.reason) {
      newValues.reason = dto.reason;
    }

    const [updatedSub] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id },
        data: updateData,
        include: { tenant: true, plan: true },
      }),
      this.prisma.platformAuditLog.create({
        data: {
          userId,
          tenantId: sub.tenantId,
          action: 'update_subscription',
          entityType: 'subscription',
          entityId: id,
          oldValues: JSON.parse(JSON.stringify(oldValues)),
          newValues: JSON.parse(JSON.stringify(newValues)),
        },
      }),
    ]);

    // If subscription was suspended/cancelled, optionally update tenant status too
    if (dto.status === 'cancelled' || dto.status === 'expired') {
      await this.prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { status: 'suspended' },
      });
    } else if (dto.status === 'active' && sub.tenant.status === 'suspended') {
      await this.prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { status: 'active' },
      });
    }

    return updatedSub;
  }

  async extendTrial(
    id: string,
    dto: ExtendTrialDto,
    userId: string,
  ) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: { tenant: true, plan: true },
    });

    if (!sub) {
      throw new NotFoundException('الاشتراك غير موجود');
    }

    const oldEnd = sub.currentPeriodEnd;
    const newEnd = new Date(sub.currentPeriodEnd);
    newEnd.setDate(newEnd.getDate() + dto.days);

    const [updatedSub] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id },
        data: {
          currentPeriodEnd: newEnd,
          // If it was expired, reactivate as trial
          ...(sub.status === 'expired' ? { status: 'trial' } : {}),
        },
        include: { tenant: true, plan: true },
      }),
      this.prisma.platformAuditLog.create({
        data: {
          userId,
          tenantId: sub.tenantId,
          action: 'extend_trial',
          entityType: 'subscription',
          entityId: id,
          oldValues: { currentPeriodEnd: oldEnd, status: sub.status },
          newValues: {
            currentPeriodEnd: newEnd,
            days: dto.days,
            reason: dto.reason || null,
          },
        },
      }),
    ]);

    // Also update tenant trialEndsAt if tenant is in trial
    if (sub.tenant.status === 'trial' || sub.status === 'trial') {
      await this.prisma.tenant.update({
        where: { id: sub.tenantId },
        data: {
          trialEndsAt: newEnd,
          status: 'trial',
        },
      });
    }

    return updatedSub;
  }

  // ═══════════════════ Force Actions ═══════════════════

  async forceLogoutTenant(tenantId: string, adminId: string) {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    // Log to audit
    await this.prisma.platformAuditLog.create({
      data: {
        userId: adminId,
        tenantId,
        action: 'force_logout',
        entityType: 'tenant',
        entityId: tenantId,
        newValues: { action: 'force_logout_all_users' },
      },
    });

    return {
      success: true,
      tenantId,
      message: 'تم تسجيل خروج جميع مستخدمي المنشأة',
    };
  }

  async forcePasswordReset(tenantId: string, adminId: string) {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    // Log to audit
    await this.prisma.platformAuditLog.create({
      data: {
        userId: adminId,
        tenantId,
        action: 'force_password_reset',
        entityType: 'tenant',
        entityId: tenantId,
        newValues: { action: 'force_password_reset_all_users' },
      },
    });

    // Force logout as well
    await this.forceLogoutTenant(tenantId, adminId);

    return {
      success: true,
      tenantId,
      message: 'تم إجبار جميع المستخدمين على تغيير كلمة المرور',
    };
  }
}
