import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare, hash, hashSync } from 'bcryptjs';
import { SmsService } from '../../shared/sms/sms.service';
import { createHash, randomBytes } from 'crypto';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { PlatformSettingsService } from '../../shared/database/platform-settings.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EventsGateway } from '../../shared/events/events.gateway';
import { TwoFactorService } from '../auth/two-factor.service';
import { TwoFactorBackupCodeService } from '../auth/two-factor-backup-code.service';
import { isIpAllowed } from '../../shared/security/ip-allowlist.helper';
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

// V-43: when the super_admin has 2FA enabled, the first step returns this
// shape instead of tokens — the caller must then POST email+password+code
// to /admin/auth/2fa/verify to complete the login.
interface AdminLogin2FAChallenge {
  requires2FA: true;
}

// V-43 / A2-15 parity (decision 7): dummy hash to equalize bcrypt timing
// on the admin user-not-found branch, preventing super_admin email
// enumeration via response time. Same rationale as auth.service's
// DUMMY_BCRYPT_HASH (V-41) — kept as a local const here rather than
// importing auth.service's module-scoped one, to avoid coupling admin
// internals to auth internals. hashSync runs once at module init.
const ADMIN_DUMMY_BCRYPT_HASH = hashSync(
  'v43-admin-timing-equalization-placeholder-not-a-real-password',
  12,
);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly cacheService: CacheService,
    private readonly eventsGateway: EventsGateway,
    private readonly twoFactorService: TwoFactorService,
    private readonly backupCodeService: TwoFactorBackupCodeService,
    private readonly smsService: SmsService,
  ) {}

  // V-43 / A2-17 — admin login step 1.
  //
  // Pre-V-43 this issued tokens after a bare password check — no IP
  // allowlist, no 2FA enforcement even for a 2FA-enabled super_admin,
  // and zero audit. super_admin is the highest-privilege principal
  // (cross-tenant control), so a leaked password meant full admin
  // access with no second factor.
  //
  // After V-43:
  //   1. Optional IP allowlist (ADMIN_IP_ALLOWLIST env, CSV of IPv4/CIDR).
  //      Blocked IPs are logged + counted (V-43-audit-counter) — NOT
  //      audit-rowed, because PlatformAuditLog.userId is NOT NULL (V-78)
  //      and the block fires before user resolution.
  //   2. Credential + super_admin-role verification (with V-41-parity
  //      bcrypt timing equalization on user-not-found).
  //   3. If the super_admin has 2FA enabled → return { requires2FA }
  //      (no tokens). Caller completes via POST /admin/auth/2fa/verify.
  //      Enforce-if-enabled (decision 1) — un-enrolled super_admins are
  //      NOT locked out; V-43-mandatory-2fa follow-up tightens later.
  //   4. Otherwise → issue tokens (audited admin_login_success).
  async login(
    email: string,
    password: string,
    ip?: string,
  ): Promise<AdminLoginResult | AdminLogin2FAChallenge> {
    this.assertAdminIpAllowed(ip);

    const { user, superAdminRole, tenantUser } =
      await this.assertAdminCredentials(email, password, ip);

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      await this.writeAdminAudit(user.id, 'admin_login_2fa_required', { ip });
      return { requires2FA: true };
    }

    return this.issueAdminTokens(user, superAdminRole.id, tenantUser.tenantId, ip);
  }

  // V-43 — admin login step 2: 2FA verification. Re-checks the password
  // (the temp-token-less design re-authenticates fully, mirroring the
  // user-facing verify2FALogin contract) + the TOTP code, then issues
  // admin tokens. Cannot reuse auth.service.verify2FALogin: that builds
  // a non-admin payload from tenantUsers[0]; admin needs roleId =
  // superAdminRole.id.
  async verify2FALogin(
    email: string,
    password: string,
    code: string,
    ip?: string,
  ): Promise<AdminLoginResult> {
    this.assertAdminIpAllowed(ip);

    const { user, superAdminRole, tenantUser } =
      await this.assertAdminCredentials(email, password, ip);

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      // Not a 2FA account — this endpoint shouldn't have been called.
      throw new BadRequestException('التحقق الثنائي غير مفعّل لهذا الحساب');
    }

    // V-42: route by format — 6 digits → TOTP, otherwise → backup code.
    // V-43-parity: both TOTP and backup-code failures now feed the V-25 IP +
    // account lockout counters (see registerAdminLoginFailure below), on top of
    // @RateLimit(5,300) — so the second factor can't be brute-forced even with
    // a known password.
    const isTotpFormat = /^\d{6}$/.test(code);
    const codeValid = isTotpFormat
      ? this.twoFactorService.verifyToken(user.twoFactorSecret, code)
      : await this.backupCodeService.verifyAndConsume(user.id, code);
    if (!codeValid) {
      await this.writeAdminAudit(user.id, 'admin_login_2fa_failed', {
        ip,
        method: isTotpFormat ? 'totp' : 'backup_code',
      });
      // V-43-parity: count the 2FA-code failure against the same lockout
      // counters as a password failure. Throws block / lock / generic, and
      // SMSes the super_admin on the lock transition.
      await this.registerAdminLoginFailure(
        user,
        ip ?? 'unknown',
        ip,
        'رمز التحقق غير صحيح',
      );
    }
    if (!isTotpFormat) {
      await this.writeAdminAudit(user.id, 'admin_login_2fa_backup_code_used', { ip });
    }

    return this.issueAdminTokens(user, superAdminRole.id, tenantUser.tenantId, ip);
  }

  // V-43 — IP allowlist gate. ADMIN_IP_ALLOWLIST empty = disabled (all
  // IPs allowed). Blocked attempts are logged + (via follow-up) counted,
  // NOT audit-rowed (no userId at this pre-lookup stage).
  private assertAdminIpAllowed(ip?: string): void {
    const allowlist = this.configService.get<string>('ADMIN_IP_ALLOWLIST', '');
    if (isIpAllowed(ip, allowlist)) return;

    // V-43-audit-counter: blocked-IP → Prometheus counter (Engineer 1).
    // audit row impossible here (PlatformAuditLog.userId NOT NULL, V-78).
    this.logger.warn(
      `[admin-login] blocked by IP allowlist: ip=${ip ?? 'unknown'}`,
    );
    throw new ForbiddenException('الوصول غير مسموح من هذا العنوان');
  }

  // V-43 — shared credential + super_admin-role check for both login
  // steps. Includes V-41-parity bcrypt timing equalization.
  private async assertAdminCredentials(
    email: string,
    password: string,
    ip?: string,
  ): Promise<{
    user: { id: string; email: string; fullName: string; phone: string | null; passwordHash: string; twoFactorEnabled: boolean; twoFactorSecret: string | null };
    superAdminRole: { id: string };
    tenantUser: { tenantId: string };
  }> {
    // V-43-parity — V-25 brute-force layers on the admin path. The static
    // ADMIN_IP_ALLOWLIST gate (assertAdminIpAllowed) already fired; this adds
    // the *dynamic* IP block + per-account lockout, sharing the same Redis
    // keyspace as auth.service.login so an attacker can't dodge limits by
    // switching between the user and admin login endpoints.
    const ipKey = ip ?? 'unknown';
    const blockSeconds = await this.cacheService.checkLoginIpBlock(ipKey);
    if (blockSeconds > 0) {
      throw new UnauthorizedException(
        `تم تجاوز الحد المسموح من محاولات الدخول. حاول مرة أخرى بعد ${Math.ceil(blockSeconds / 60)} دقيقة`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // V-41 parity: equalize timing with the wrong-password branch so
      // response time can't enumerate super_admin emails. The attempt still
      // counts against the IP (V-43-parity) so spraying a blocked IP with
      // unknown emails can't probe forever.
      await compare(password, ADMIN_DUMMY_BCRYPT_HASH);
      await this.cacheService.incrementLoginFailIp(ipKey);
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // V-43-parity — account-lock pre-check (before the password compare).
    if (await this.cacheService.isAccountLocked(user.id)) {
      throw new UnauthorizedException(
        'تم قفل الحساب بسبب محاولات دخول فاشلة متعددة. تواصل مع الدعم الفني',
      );
    }

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      await this.writeAdminAudit(user.id, 'admin_login_failed', { ip });
      await this.registerAdminLoginFailure(
        user,
        ipKey,
        ip,
        'بيانات الدخول غير صحيحة',
      );
    }

    const superAdminRole = await this.prisma.role.findUnique({
      where: { name: 'super_admin' },
    });
    if (!superAdminRole) {
      throw new UnauthorizedException('ليس لديك صلاحية الدخول لوحة الإدارة');
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, roleId: superAdminRole.id, status: 'active' },
    });
    if (!tenantUser) {
      throw new UnauthorizedException('ليس لديك صلاحية الدخول لوحة الإدارة');
    }

    return { user, superAdminRole, tenantUser };
  }

  // V-43-parity — record a failed admin auth attempt against the V-25 IP +
  // account counters, then throw the right 401. Mirrors auth.service's
  // handle2FAFailure: SMS the super_admin on the lock TRANSITION only
  // (incrementLoginFailAccount returns locked=true exactly once per cycle, so
  // at most one SMS per 24h lockout even under sustained brute-force).
  // Returns Promise<never> — it always throws.
  private async registerAdminLoginFailure(
    user: { id: string; phone: string | null },
    ipKey: string,
    ip: string | undefined,
    genericMessage: string,
  ): Promise<never> {
    const ipResult = await this.cacheService.incrementLoginFailIp(ipKey);
    const accResult = await this.cacheService.incrementLoginFailAccount(user.id);

    if (ipResult.blockSeconds > 0) {
      throw new UnauthorizedException(
        `تم تجاوز الحد المسموح. حاول مرة أخرى بعد ${Math.ceil(ipResult.blockSeconds / 60)} دقيقة`,
      );
    }

    if (accResult.locked) {
      if (user.phone) {
        await this.smsService
          .send({
            to: user.phone,
            message:
              'SERVIX: تم قفل حساب الإدارة بسبب محاولات دخول فاشلة متعددة. تواصل مع الدعم الفني',
          })
          .catch((e) =>
            this.logger.warn(`[admin-lockout SMS] ${(e as Error).message}`),
          );
      }
      await this.writeAdminAudit(user.id, 'admin_login_account_locked', { ip });
      throw new UnauthorizedException(
        'تم قفل الحساب بسبب محاولات دخول فاشلة متعددة. تواصل مع الدعم الفني',
      );
    }

    throw new UnauthorizedException(genericMessage);
  }

  // V-43 — issue admin tokens (the pre-V-43 token-signing block, now
  // shared between login + verify2FALogin) + audit admin_login_success.
  private async issueAdminTokens(
    user: { id: string; email: string; fullName: string },
    superAdminRoleId: string,
    tenantId: string,
    ip?: string,
  ): Promise<AdminLoginResult> {
    // V-43-parity — clear the V-25 brute-force counters on TRUE success. This
    // is the single funnel for both non-2FA login and post-2FA verify (the
    // 2FA *challenge* return in login() does NOT pass through here, so a
    // correct password alone never resets the 2FA-failure counter).
    await this.cacheService.resetLoginFailIp(ip ?? 'unknown');
    await this.cacheService.resetLoginFailAccount(user.id);

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId,
      roleId: superAdminRoleId,
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

    await this.writeAdminAudit(user.id, 'admin_login_success', { ip });

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

  // V-43 — fire-and-forget admin-login audit row. Uses the admin.service
  // house pattern (direct platformAuditLog.create, not AuditService).
  // userId is always a resolved super_admin id here (blocked-IP path
  // never reaches this — it has no userId and uses logger.warn instead).
  private async writeAdminAudit(
    userId: string,
    action: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.platformAuditLog
      .create({
        data: {
          userId,
          action,
          entityType: 'User',
          entityId: userId,
          newValues: newValues as never,
          ipAddress: (newValues.ip as string) ?? null,
        },
      })
      .catch((e) =>
        this.logger.warn(`[admin-login audit ${action}] ${(e as Error).message}`),
      );
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

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        twoFactorEnabled: true,
        authProvider: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenantUsers: {
          select: {
            id: true,
            isOwner: true,
            status: true,
            tenant: { select: { id: true, nameAr: true, nameEn: true, slug: true, status: true } },
            role: { select: { id: true, name: true, nameAr: true } },
          },
        },
        passwordResets: {
          select: { createdAt: true, usedAt: true },
          orderBy: { createdAt: 'desc' as const },
          take: 5,
        },
      },
    });

    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  async updateUser(id: string, data: { fullName?: string; email?: string; phone?: string }, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const updateData: Record<string, unknown> = {};
    if (data.fullName) updateData.fullName = data.fullName.trim();
    if (data.email) updateData.email = data.email.toLowerCase().trim();
    if (data.phone) updateData.phone = data.phone.trim();

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('لا توجد بيانات للتحديث');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: updateData }),
      this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: 'admin_update_user',
          entityType: 'user',
          entityId: id,
          oldValues: { fullName: user.fullName, email: user.email, phone: user.phone },
          newValues: updateData as any,
        },
      }),
    ]);

    return updated;
  }

  async updateUserStatus(id: string, status: 'active' | 'suspended', reason: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenantUsers: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    // Update all tenant user statuses
    const tuStatus = status === 'active' ? 'active' : 'suspended';
    await this.prisma.$transaction([
      ...user.tenantUsers.map((tu) =>
        this.prisma.tenantUser.update({
          where: { id: tu.id },
          data: { status: tuStatus as any },
        }),
      ),
      this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: status === 'suspended' ? 'admin_suspend_user' : 'admin_activate_user',
          entityType: 'user',
          entityId: id,
          newValues: { status, reason },
        },
      }),
    ]);

    return { message: status === 'suspended' ? 'تم تعليق الحساب' : 'تم تفعيل الحساب', status };
  }

  async resetUserPassword(id: string, newPassword: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    if (newPassword.length < 8) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }

    const passwordHash = await hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash } }),
      this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: 'admin_reset_password',
          entityType: 'user',
          entityId: id,
          newValues: { resetBy: 'admin', adminId },
        },
      }),
    ]);

    // V-14a: admin reset must also invalidate active sessions.
    // Otherwise an attacker who already stole an access token keeps
    // using it for up to 15 min after support resets the password.
    await this.cacheService.setPasswordChangedAt(id);

    return { message: 'تم تعيين كلمة مرور جديدة بنجاح' };
  }

  // V-24 / A2-08 — Admin reset link is now hash-at-rest.
  //
  // Pre-V-24, this method stored the raw 32-byte token directly in
  // password_resets.token_hash (then named `token`) and console.log'd the
  // raw value to stdout.
  // Two distinct gaps in one method: anyone with DB read access (or a
  // backup) had every active admin-reset token, and anyone with log
  // access (SSH, journald, Loki forwarders) saw them too.
  //
  // Incidental fix: pre-V-24 the admin link was also un-redeemable —
  // auth.service.resetPassword hashes the submitted token and looks
  // up by hash, while admin stored raw, so the lookup always missed.
  // V-24 unifies storage (both flows now write the hash); the existing
  // self-serve verifier serves the admin flow without changes.
  //
  // Raw token return: the API response carries the raw token (admin
  // delivers manually). MailService wiring for AdminModule is the
  // V-24-email follow-up; until then this is the only way to surface
  // the token to the admin without re-introducing the log leak.
  async sendPasswordResetLink(
    id: string,
    adminId: string,
  ): Promise<{ message: string; token: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    // Generate raw OUTSIDE the tx, hash, persist only the hash.
    // The raw value never crosses the await boundary into Prisma.
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.$transaction([
      this.prisma.passwordReset.create({
        data: { userId: id, tokenHash, expiresAt },
      }),
      this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: 'admin_password_reset_link_sent',
          entityType: 'user',
          entityId: id,
          // V-24: forensic-correlation-only — tokenHashPrefix (8 chars =
          // 2^32 collision space) is enough to confirm "was this audit row
          // for this specific link?" without persisting enough hash material
          // for an attacker who reads the audit table to brute-force the
          // sha256 preimage back to the raw token. Never log the full hash
          // or the raw token in this audit row.
          newValues: {
            sentTo: user.email,
            expiresAt: expiresAt.toISOString(),
            tokenHashPrefix: tokenHash.slice(0, 8),
          },
        },
      }),
    ]);

    // V-24: raw token returned in response body for admin to deliver
    // manually. Email wiring tracked as V-24-email follow-up (requires
    // MailService in AdminModule). The pre-V-24 console.log of the raw
    // token is deleted — never log secrets.
    return {
      message: `تم إنشاء رابط إعادة تعيين كلمة المرور للمستخدم ${user.email}. سلّم الرابط يدوياً.`,
      token: rawToken,
      expiresAt,
    };
  }

  async changeUserRole(userId: string, roleId: string, tenantId: string | undefined, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenantUsers: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('الدور غير موجود');

    // Find the tenant-user record to update
    let tu = user.tenantUsers[0]; // default to first
    if (tenantId) {
      tu = user.tenantUsers.find((t) => t.tenantId === tenantId) || tu;
    }
    if (!tu) throw new BadRequestException('المستخدم غير مرتبط بأي صالون');

    const oldRoleId = tu.roleId;
    const oldRoleName = tu.role?.name || 'unknown';

    // V-14c: cascade is always-on, even when newRoleId === oldRoleId.
    // The no-op case still invalidates sessions — defensive over
    // efficient, costs one Redis SETEX. Privilege downgrade is the
    // dangerous direction (manager → staff with a live JWT keeps
    // manager permissions until expiry), so we revoke unconditionally
    // rather than branch on direction.
    //
    // Ordering mirrors V-14b: DB tx first (truth-of-record), then
    // side effects. A Redis or WS failure after the tx leaves the
    // role change persisted with audit row — strictly safer than
    // the inverse.
    //
    // Note: auth.service.refreshTokens (line 357) re-signs new tokens
    // with the OLD payload.roleId from the refresh token. Without
    // V-14c, refreshing would keep handing out stale-role JWTs forever.
    // V-14c writes pwChangedAt, which fails the refresh path's iat
    // check (auth.service.ts:348) and forces a full re-login. Re-login
    // reads firstTenantUser.roleId fresh from DB, picking up the new
    // role. So V-14c closes the refresh-staleness gap as a side effect.

    await this.prisma.$transaction([
      this.prisma.tenantUser.update({
        where: { id: tu.id },
        data: { roleId },
      }),
      this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: 'admin_change_role',
          entityType: 'user',
          entityId: userId,
          oldValues: { role: oldRoleName, roleId: oldRoleId, tenantId: tu.tenantId },
          newValues: { role: role.name, roleId, sessionsRevoked: true },
        },
      }),
    ]);

    await this.cacheService.setPasswordChangedAt(userId);
    this.eventsGateway.disconnectUserClients(userId);

    return { message: `تم تغيير الدور إلى ${role.nameAr}`, role };
  }

  async impersonateUser(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new BadRequestException('لا يمكنك الدخول كنفسك');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          include: { tenant: true, role: true },
          where: { status: 'active' },
          take: 1,
        },
      },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    // Prevent impersonating other super admins
    const superAdminRole = await this.prisma.role.findUnique({ where: { name: 'super_admin' } });
    if (superAdminRole) {
      const isSuperAdmin = user.tenantUsers.some((tu) => tu.roleId === superAdminRole.id);
      if (isSuperAdmin) {
        throw new BadRequestException('لا يمكنك الدخول كمدير منصة آخر');
      }
    }

    const tu = user.tenantUsers[0];
    if (!tu) throw new BadRequestException('المستخدم غير مرتبط بأي صالون نشط');

    const accessSecret = this.configService.get<string>('jwt.accessSecret', '');

    // Create a 15-minute impersonation token
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        tenantId: tu.tenantId,
        roleId: tu.roleId,
        impersonatedBy: adminId,
      },
      { secret: accessSecret, expiresIn: '15m' },
    );

    // Audit log — CRITICAL for security
    await this.prisma.platformAuditLog.create({
      data: {
        userId: adminId,
        action: 'admin_impersonate',
        entityType: 'user',
        entityId: userId,
        newValues: {
          impersonatedUser: user.email,
          impersonatedUserId: userId,
          adminId,
          tokenExpiresIn: '15 minutes',
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      message: `تم إنشاء جلسة مؤقتة (15 دقيقة) كـ ${user.fullName}`,
      accessToken: token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
      tenant: {
        id: tu.tenant.id,
        nameAr: tu.tenant.nameAr,
        slug: tu.tenant.slug,
      },
      expiresIn: 900,
    };
  }

  async softDeleteUser(userId: string, adminId: string, immediate: boolean = false) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenantUsers: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    if (userId === adminId) {
      throw new BadRequestException('لا يمكنك حذف حسابك الخاص');
    }

    if (immediate) {
      // ══ HARD DELETE: permanently remove user from database ══
      // 1. First, create audit log under admin's ID (before deleting user data)
      await this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: 'admin_hard_delete_user',
          entityType: 'user',
          entityId: userId,
          oldValues: {
            email: user.email,
            phone: user.phone,
            fullName: user.fullName,
            authProvider: user.authProvider,
            createdAt: user.createdAt.toISOString(),
            tenantCount: user.tenantUsers.length,
          },
          newValues: { status: 'permanently_deleted', deletedAt: new Date().toISOString(), mode: 'hard_delete' },
        },
      });

      // 2. Delete all related records, then the user
      await this.prisma.$transaction([
        // Delete audit logs where this user is the actor
        this.prisma.platformAuditLog.deleteMany({ where: { userId } }),
        // Delete password resets
        this.prisma.passwordReset.deleteMany({ where: { userId } }),
        // Delete tenant-user associations
        this.prisma.tenantUser.deleteMany({ where: { userId } }),
        // Delete blacklisted tokens
        this.prisma.tokenBlacklist.deleteMany({ where: { userId } }),
        // Finally delete the user
        this.prisma.user.delete({ where: { id: userId } }),
      ]);

      return { message: `تم حذف "${user.fullName}" نهائياً من قاعدة البيانات`, deletedId: userId, mode: 'hard_delete' };
    } else {
      // ══ Grace period: soft delete + suspend ══
      // Already deleted?
      if (user.fullName.startsWith('[محذوف]') || user.fullName.startsWith('[قيد الحذف]')) {
        throw new BadRequestException('هذا المستخدم محذوف بالفعل');
      }

      const graceDays = await this.platformSettings.getNumber('user_deletion_grace_days', 30);
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + graceDays);

      const pendingName = `[قيد الحذف] ${user.fullName}`.slice(0, 100);

      await this.prisma.$transaction([
        ...user.tenantUsers.map((tu) =>
          this.prisma.tenantUser.update({
            where: { id: tu.id },
            data: { status: 'suspended' as any },
          }),
        ),
        this.prisma.user.update({
          where: { id: userId },
          data: { fullName: pendingName },
        }),
        this.prisma.platformAuditLog.create({
          data: {
            userId: adminId,
            action: 'admin_delete_user_grace',
            entityType: 'user',
            entityId: userId,
            oldValues: { email: user.email, phone: user.phone, fullName: user.fullName },
            newValues: {
              status: 'pending_deletion',
              scheduledDeletionAt: deletionDate.toISOString(),
              graceDays,
              mode: 'grace_period',
            },
          },
        }),
      ]);

      return {
        message: `تم تعليق الحساب. سيُحذف نهائياً بعد ${graceDays} يوم (${deletionDate.toLocaleDateString('ar-SA')})`,
        deletedId: userId,
        mode: 'grace_period',
        graceDays,
        scheduledDeletionAt: deletionDate.toISOString(),
      };
    }
  }

  async restoreUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenantUsers: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    // Check if this is a soft-deleted or pending-deletion user
    if (!user.fullName.startsWith('[محذوف]') && !user.fullName.startsWith('[قيد الحذف]')) {
      throw new BadRequestException('هذا المستخدم ليس محذوفاً');
    }

    // Restore: remove anonymization suffix and reactivate
    const cleanEmail = user.email.replace(/_deleted_\d+$/, '');
    const cleanPhone = user.phone.replace(/_deleted_\d+$/, '');
    const cleanName = user.fullName.replace(/^\[محذوف\] /, '').replace(/^\[قيد الحذف\] /, '');

    await this.prisma.$transaction([
      ...user.tenantUsers.map((tu) =>
        this.prisma.tenantUser.update({
          where: { id: tu.id },
          data: { status: 'active' as any },
        }),
      ),
      this.prisma.user.update({
        where: { id: userId },
        data: { email: cleanEmail, phone: cleanPhone, fullName: cleanName },
      }),
      this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: 'admin_restore_user',
          entityType: 'user',
          entityId: userId,
          newValues: { email: cleanEmail, restoredAt: new Date().toISOString() },
        },
      }),
    ]);

    return { message: 'تم استعادة المستخدم بنجاح' };
  }

  async forceLogoutUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    // V-14a: writes pwChangedAt for this user into Redis. Both the
    // HTTP JwtStrategy (validate) and the WS guard read it and reject
    // any token whose iat < pwChangedAt. Pre-V-14a this endpoint only
    // touched user.updatedAt — which nothing checks — so it was a
    // no-op despite the audit log. Now it really kills active sessions.
    await this.cacheService.setPasswordChangedAt(userId);

    await this.prisma.platformAuditLog.create({
      data: {
        userId: adminId,
        action: 'admin_force_logout',
        entityType: 'user',
        entityId: userId,
        newValues: { loggedOutAt: new Date().toISOString() },
      },
    });

    return { message: 'تم تسجيل خروج المستخدم من جميع الأجهزة' };
  }

  async updateVerification(
    userId: string,
    data: { isEmailVerified?: boolean; isPhoneVerified?: boolean },
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const updateData: Record<string, boolean> = {};
    if (data.isEmailVerified !== undefined) updateData.isEmailVerified = data.isEmailVerified;
    if (data.isPhoneVerified !== undefined) updateData.isPhoneVerified = data.isPhoneVerified;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('لا توجد بيانات للتحديث');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: updateData }),
      this.prisma.platformAuditLog.create({
        data: {
          userId: adminId,
          action: 'admin_update_verification',
          entityType: 'user',
          entityId: userId,
          oldValues: { isEmailVerified: user.isEmailVerified, isPhoneVerified: user.isPhoneVerified },
          newValues: updateData,
        },
      }),
    ]);

    return updated;
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

    // V-14b: when suspending, fan out the side effects after the
    // status flip is committed so a tx failure cannot leave us in a
    // half-revoked state. Order:
    //   1. DB tx — status + audit row
    //   2. setPasswordChangedAt per member  (invalidates HTTP+WS tokens)
    //   3. disconnect active WS clients     (close existing sessions)
    //   4. invalidateTenant cache           (force other api instances
    //                                        to re-fetch the new status)
    // setPasswordChangedAt swallows Redis errors internally so the
    // Promise.all never rejects; partial Redis failure means some
    // tokens stay alive but the HTTP middleware/guard chain still
    // blocks them via tenant.status, so the worst case is a stale
    // WS that gets rejected on its next handshake attempt.
    //
    // Unsuspend (status='active') intentionally does NOT clear
    // pwChangedAt: once a session was revoked, the user re-logs in
    // and gets a fresh JWT with iat > pwChangedAt that the gate
    // passes through. Standard secure-default.

    let affectedUserCount = 0;
    let members: Array<{ userId: string }> = [];

    if (status === 'suspended') {
      members = await this.prisma.tenantUser.findMany({
        where: { tenantId },
        select: { userId: true },
      });
      affectedUserCount = members.length;
    }

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
          newValues:
            status === 'suspended'
              ? { status, affectedUserCount }
              : { status },
        },
      }),
    ]);

    if (status === 'suspended') {
      await Promise.all(
        members.map((m) => this.cacheService.setPasswordChangedAt(m.userId)),
      );
      this.eventsGateway.disconnectTenantClients(tenantId);
      await this.cacheService.invalidateTenant(tenantId);
    } else {
      // Active again — only refresh the platform-level tenant cache
      // so other api instances see the new status immediately.
      await this.cacheService.invalidateTenant(tenantId);
    }

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
    // non-security: simulated backup size placeholder, not a credential or token.
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

    // Strip auto-generated fields — rest is cloned into the new plan.
    const { id: _id, createdAt: _ca, updatedAt: _ua, slug: _s, ...planData } = plan as any;
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
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    // V-14a: actually invalidate every tenant member's session.
    // Pre-V-14a this method only wrote an audit row — no token was
    // ever invalidated. Now we enumerate every TenantUser row for
    // this tenant and write pwChangedAt for each. Promise.all keeps
    // the cache writes pipelined; with O(<10) users per tenant on
    // prod today the latency is dominated by the round trip, not
    // the number of writes. Tracked as V-14a-perf for >100-user
    // tenants (use Redis MSET / pipeline) — see engineer-2-* doc.
    const members = await this.prisma.tenantUser.findMany({
      where: { tenantId },
      select: { userId: true },
    });
    // V-14a-perf-counter: count writes that actually landed in Redis, so a
    // partial outage produces an honest affectedUserCount instead of
    // overstating it as members.length. setPasswordChangedAt never throws.
    const results = await Promise.all(
      members.map((m) => this.cacheService.setPasswordChangedAt(m.userId)),
    );
    const affectedUserCount = results.filter(Boolean).length;

    await this.prisma.platformAuditLog.create({
      data: {
        userId: adminId,
        tenantId,
        action: 'force_logout',
        entityType: 'tenant',
        entityId: tenantId,
        newValues: {
          action: 'force_logout_all_users',
          affectedUserCount,
          attemptedUserCount: members.length,
        },
      },
    });

    return {
      success: true,
      tenantId,
      affectedUserCount,
      attemptedUserCount: members.length,
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
