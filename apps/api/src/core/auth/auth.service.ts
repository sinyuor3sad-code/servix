import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcryptjs';
import { v4 } from 'uuid';
import { createHash, randomBytes, randomInt } from 'crypto';
import type { RefreshToken } from '../../shared/database';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { TenantDatabaseService } from '../../shared/database/tenant-database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { MailService } from '../../shared/mail/mail.service';
import { SmsService } from '../../shared/sms/sms.service';
import { JwtPayload, JwtTokens } from '../../shared/types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorBackupCodeService } from './two-factor-backup-code.service';
import { GoogleAuthService } from './google-auth.service';
import { AuditService } from '../audit/audit.service';
import { SentryService } from '../../shared/sentry/sentry.service';
import { AUTH_PROVIDERS } from './auth.constants';

interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
}

interface TenantResponse {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
}

interface RoleResponse {
  id: string;
  name: string;
  nameAr: string;
}

interface TenantWithRole {
  id: string;
  tenantId: string;
  roleId: string;
  isOwner: boolean;
  tenant: TenantResponse;
  role: RoleResponse;
}

interface RegisterResult {
  user: UserResponse;
  tenant: TenantResponse;
  requiresVerification: boolean;
  message: string;
}

interface LoginResult {
  user: UserResponse;
  tenants: TenantWithRole[];
  tokens: JwtTokens | null;
  requires2FA: boolean;
}

interface MeResult {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  tenantUsers: TenantWithRole[];
}

const BCRYPT_ROUNDS = 12;

// V-41 / A2-15 — pre-computed dummy hash used to equalize bcrypt timing
// on the user-not-found branches of login + verify2FALogin. Without this
// the user-not-found path skips compare() entirely (~5-20ms total) while
// the user-found+wrong-password path burns ~150ms — a trivially-observable
// delta over network noise (Riyadh DC p99 ~100ms) that an attacker uses
// to enumerate valid emails.
//
// hashSync runs ONCE at module init (~150ms one-time boot cost, invisible
// at request time). Auto-syncs with BCRYPT_ROUNDS — if the cost factor
// changes, the dummy hash regenerates on next deploy with matching cost,
// preserving timing parity automatically. No magic-constant drift risk.
//
// The compare() return value is always false (this placeholder string
// won't match any real password) and is deliberately discarded — the
// only side effect we want is the ~150ms CPU work.
const DUMMY_BCRYPT_HASH = hashSync(
  'v41-timing-equalization-placeholder-not-a-real-password',
  BCRYPT_ROUNDS,
);

const RESET_TOKEN_EXPIRY_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly tenantDatabaseService: TenantDatabaseService,
    private readonly twoFactorService: TwoFactorService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly auditService: AuditService,
    private readonly sentryService: SentryService,
    private readonly backupCodeService: TwoFactorBackupCodeService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    this.logger.log(`[AuthService.register] Starting registration for email=${dto.email}`);

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('البريد الإلكتروني مسجل مسبقاً');
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('رقم الجوال مسجل مسبقاً');
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    const slugBase = dto.salonNameEn
      ? this.generateSlug(dto.salonNameEn)
      : 'salon';
    const uniqueId = v4().split('-')[0];
    const slug = `${slugBase}-${uniqueId}`;
    const databaseName = `servix_tenant_${uniqueId}`;

    const ownerRole = await this.prisma.role.findUnique({
      where: { name: 'owner' },
    });
    if (!ownerRole) {
      throw new InternalServerErrorException(
        'خطأ في النظام: لم يتم العثور على دور المالك',
      );
    }


    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          // V-13a: explicit instead of relying on schema default. Makes the
          // register-path contract greppable and consistent with the Google
          // paths that also stamp authProvider explicitly.
          authProvider: AUTH_PROVIDERS.LOCAL,
        },
      });
      this.logger.log(`[AuthService.register] Created user id=${user.id}`);

      const tenant = await tx.tenant.create({
        data: {
          nameAr: dto.salonNameAr,
          nameEn: dto.salonNameEn ?? dto.salonNameAr,
          slug,
          databaseName,
          status: 'pending',
        },
      });
      this.logger.log(`[AuthService.register] Created tenant id=${tenant.id}, slug=${slug} (pending verification)`);

      const tenantUser = await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: ownerRole.id,
          isOwner: true,
        },
      });
      this.logger.log(`[AuthService.register] Created tenantUser id=${tenantUser.id}, roleId=${ownerRole.id}`);

      // V-35b: the audit row joins THIS platform transaction, so it is atomic
      // with the user/tenant/tenantUser creation. If the outbox insert fails,
      // registration rolls back (no silent loss); if registration rolls back,
      // the audit row is discarded with it.
      await this.auditService.log(
        {
          tenantId: tenant.id,
          userId: user.id,
          action: 'auth.register',
          entityType: 'User',
          entityId: user.id,
          newValues: { email: user.email, tenantSlug: tenant.slug },
        },
        tx,
      );

      return { user, tenant };
    });

    const tenantResponse: TenantResponse = {
      id: result.tenant.id,
      nameAr: result.tenant.nameAr,
      nameEn: result.tenant.nameEn,
      slug: result.tenant.slug,
    };

    // Generate and send email OTP
    await this.sendEmailOtpInternal(result.user.email, result.user.fullName);

    return {
      user: this.mapUserResponse(result.user),
      tenant: tenantResponse,
      requiresVerification: true,
      message: 'تم إنشاء الحساب. يرجى إدخال رمز التحقق المرسل إلى بريدك الإلكتروني',
    };
  }

  async login(dto: LoginDto, ip: string): Promise<LoginResult> {
    const blockSeconds = await this.cacheService.checkLoginIpBlock(ip);
    if (blockSeconds > 0) {
      throw new UnauthorizedException(
        `تم تجاوز الحد المسموح من محاولات الدخول. حاول مرة أخرى بعد ${Math.ceil(blockSeconds / 60)} دقيقة`,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.emailOrPhone }, { phone: dto.emailOrPhone }],
      },
    });

    if (user) {
      const accountLocked = await this.cacheService.isAccountLocked(user.id);
      if (accountLocked) {
        throw new UnauthorizedException(
          'تم قفل الحساب بسبب محاولات دخول فاشلة متعددة. تواصل مع الدعم الفني',
        );
      }
    }

    if (!user) {
      // V-41: equalize timing with the wrong-password branch by running
      // bcrypt against a pre-computed dummy hash. The return value
      // (always false) is intentionally discarded — only the ~150ms
      // CPU cost matters. Without this, response time alone enumerates
      // valid emails.
      await compare(dto.password, DUMMY_BCRYPT_HASH);
      await this.cacheService.incrementLoginFailIp(ip);
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // Block login if email is not verified
    if (!user.isEmailVerified) {
      // Re-send OTP automatically
      await this.sendEmailOtpInternal(user.email, user.fullName).catch(() => {});
      throw new UnauthorizedException(
        'يرجى تأكيد بريدك الإلكتروني أولاً. تم إرسال رمز تحقق جديد',
      );
    }

    const isPasswordValid = await compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const ipResult = await this.cacheService.incrementLoginFailIp(ip);
      const accResult = await this.cacheService.incrementLoginFailAccount(user.id);
      if (ipResult.blockSeconds > 0) {
        throw new UnauthorizedException(
          `تم تجاوز الحد المسموح. حاول مرة أخرى بعد ${Math.ceil(ipResult.blockSeconds / 60)} دقيقة`,
        );
      }
      if (accResult.locked) {
        await this.smsService.send({
          to: user.phone,
          message: 'SERVIX: تم قفل حسابك بسبب محاولات دخول فاشلة. تواصل مع الدعم الفني',
        });
        throw new UnauthorizedException(
          'تم قفل الحساب بسبب محاولات دخول فاشلة متعددة. تواصل مع الدعم الفني',
        );
      }
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    await this.cacheService.resetLoginFailIp(ip);
    await this.cacheService.resetLoginFailAccount(user.id);

    // Audit log: successful login. V-35b — awaited fail-loud (no silent
    // swallow). The outbox insert is a tiny no-FK platform write that only
    // fails if the platform DB is down, in which case the refresh-token write
    // below fails anyway — so this adds no new failure mode while guaranteeing
    // the login event is never silently lost.
    await this.auditService.log({
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      newValues: { ip },
    });

    // V-14b-login: skip suspended tenants so a multi-tenant user falls through
    // to their next active tenant and the issued JWT pins to an active one —
    // instead of pinning to a suspended tenant that 403s on every subsequent
    // tenant-scoped request. tenant_user.status='active' alone is not enough;
    // the tenant itself must be active.
    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, status: 'active', tenant: { status: 'active' } },
      include: {
        tenant: {
          select: { id: true, nameAr: true, nameEn: true, slug: true },
        },
        role: {
          select: { id: true, name: true, nameAr: true },
        },
      },
    });

    if (tenantUsers.length === 0) {
      throw new UnauthorizedException(
        'لا يوجد لديك صالون مرتبط. تواصل مع الدعم الفني',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Check if 2FA is enabled — return challenge instead of tokens
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      return {
        user: this.mapUserResponse(user),
        tenants: tenantUsers.map((tu) => ({
          id: tu.id,
          tenantId: tu.tenantId,
          roleId: tu.roleId,
          isOwner: tu.isOwner,
          tenant: tu.tenant,
          role: tu.role,
        })),
        tokens: null,
        requires2FA: true,
      };
    }

    const firstTenantUser = tenantUsers[0];
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: firstTenantUser.tenantId,
      roleId: firstTenantUser.roleId,
    });

    return {
      user: this.mapUserResponse(user),
      tenants: tenantUsers.map((tu) => ({
        id: tu.id,
        tenantId: tu.tenantId,
        roleId: tu.roleId,
        isOwner: tu.isOwner,
        tenant: tu.tenant,
        role: tu.role,
      })),
      tokens,
      requires2FA: false,
    };
  }

  // V-13c: opaque refresh token rotation + reuse detection.
  //   - rawToken is the 32-byte hex string given to the client at issue time.
  //     We SHA-256 it and look up the row by hash. Raw value never persisted.
  //   - DB unreachable → fail CLOSED (ServiceUnavailable). Refusing is safer
  //     than minting tokens we can't audit. Deviates from the legacy blacklist
  //     fail-open in cache.service.ts intentionally — reuse detection IS the
  //     security control here, and an attacker exploiting DB outage to replay
  //     a stolen token is exactly the threat model.
  //   - Reuse path (row.revokedAt IS NOT NULL): cascade-revoke the family,
  //     setPasswordChangedAt (kills outstanding access JWTs via V-14a),
  //     belt-and-braces cache.blacklist for the existing TokenBlacklist short-
  //     circuit, audit row + Sentry warning. See handleReuseDetected below.
  //   - Race window: two concurrent refreshes of the same valid token both
  //     see revokedAt=null and both succeed in issuing successors. The slower
  //     write loses revokedReason='rotated'. Accepted false-positive per
  //     V-13c-race-tuning follow-up.
  async refreshTokens(
    rawToken: string,
    opts: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<JwtTokens> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    let row: RefreshToken | null;
    try {
      row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    } catch (err) {
      this.logger.error(
        `[refreshTokens] DB unreachable during lookup: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'تعذّر التحقق من رمز التحديث. حاول مرة أخرى',
      );
    }

    if (!row) {
      // Unknown token: tampered, expired-and-cleaned, or a pre-V-13c legacy
      // signed-JWT that the lookup-by-hash path naturally rejects.
      throw new UnauthorizedException(
        'رمز التحديث غير صالح أو منتهي الصلاحية',
      );
    }

    if (row.revokedAt) {
      // 🚨 Replay attack. Cascade response runs to completion; only after
      // that do we return 401, so the attacker gets no timing channel
      // distinguishing reused-vs-unknown.
      await this.handleReuseDetected(row, rawToken, opts).catch((e) => {
        this.logger.error(
          `[refreshTokens] reuse-cascade failure: ${(e as Error).message}`,
        );
      });
      throw new UnauthorizedException(
        'رمز التحديث غير صالح أو منتهي الصلاحية',
      );
    }

    if (row.expiresAt < new Date()) {
      await this.prisma.refreshToken
        .update({
          where: { id: row.id },
          data: { revokedAt: new Date(), revokedReason: 'expired' },
        })
        .catch(() => {});
      throw new UnauthorizedException(
        'رمز التحديث غير صالح أو منتهي الصلاحية',
      );
    }

    // V-14a parity: pwChangedAt-after-issuance kills the token.
    const pwdChangedAt = await this.cacheService.getPasswordChangedAt(row.userId);
    if (pwdChangedAt && row.issuedAt.getTime() < pwdChangedAt) {
      await this.prisma.refreshToken
        .update({
          where: { id: row.id },
          data: { revokedAt: new Date(), revokedReason: 'pwd_changed' },
        })
        .catch(() => {});
      throw new UnauthorizedException(
        'رمز التحديث غير صالح أو منتهي الصلاحية',
      );
    }

    // Re-derive payload from the user + their primary active tenantUser.
    // V-14b-login: also require the tenant itself to be active, so a refresh
    // never re-pins the JWT to a suspended tenant.
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      include: {
        tenantUsers: {
          where: { status: 'active', tenant: { status: 'active' } },
          take: 1,
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException(
        'رمز التحديث غير صالح أو منتهي الصلاحية',
      );
    }
    const firstTU = user.tenantUsers[0];

    // Issue the successor in the same family.
    const newTokens = await this.generateTokens(
      {
        sub: user.id,
        email: user.email,
        tenantId: firstTU?.tenantId ?? '',
        roleId: firstTU?.roleId ?? '',
      },
      {
        familyId: row.familyId,
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      },
    );

    // Wire predecessor → successor by hash lookup (the only handle we have
    // on the row we just created without changing generateTokens' return shape).
    const successorHash = createHash('sha256')
      .update(newTokens.refreshToken)
      .digest('hex');
    const successor = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: successorHash },
    });

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: {
        revokedAt: new Date(),
        revokedReason: 'rotated',
        replacedByTokenId: successor?.id ?? null,
      },
    });

    return newTokens;
  }

  // V-13c: replay-attack response. Called when a refresh request lands on a
  // row whose revokedAt is already set — meaning whoever just presented this
  // token is using a copy. We assume the worst (attacker has the family's
  // current valid token too) and kill everything: every unrevoked sibling
  // in the family, plus the user's pwChangedAt to invalidate live access
  // JWTs. Also writes to the legacy cache blacklist as belt-and-braces.
  private async handleReuseDetected(
    row: RefreshToken,
    rawToken: string,
    opts: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const cascade = await this.prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'reuse_detected' },
    });

    await this.cacheService.setPasswordChangedAt(row.userId);

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.cacheService.blacklistRefreshToken(tokenHash, row.userId);

    await this.auditService
      .log({
        userId: row.userId,
        action: 'auth_refresh_reuse_detected',
        entityType: 'RefreshToken',
        entityId: row.id,
        newValues: {
          familyId: row.familyId,
          reusedTokenId: row.id,
          reusedTokenIssuedAt: row.issuedAt.toISOString(),
          reusedTokenRevokedAt: row.revokedAt?.toISOString() ?? null,
          reusedTokenRevokedReason: row.revokedReason ?? null,
          cascadeRevokedCount: cascade.count,
          ipAddress: opts.ipAddress ?? null,
          userAgent: opts.userAgent ?? null,
        },
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      });

    // captureMessage, not captureException — this is a security event, not
    // a crash. Sentry-side it should fire alert rules tagged 'warning'.
    this.sentryService.captureMessage(
      'Refresh token reuse detected',
      'warning',
    );
  }

  async logout(rawToken: string): Promise<{ message: string }> {
    if (!rawToken?.trim()) return { message: 'تم تسجيل الخروج بنجاح' };

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // V-13c: revoke the RefreshToken row (primary source of truth).
    // updateMany — by hash, only-if-not-already-revoked — handles the
    // "user clicks logout twice" idempotency case naturally.
    await this.prisma.refreshToken
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'logout' },
      })
      .catch((e) => {
        this.logger.warn(
          `[logout] refresh row revoke failed: ${(e as Error).message}`,
        );
      });

    // V-13c coexistence with the legacy TokenBlacklist (V-13c-cleanup
    // follow-up consolidates this). Belt-and-braces during cutover.
    await this.cacheService.blacklistRefreshToken(tokenHash);

    return { message: 'تم تسجيل الخروج بنجاح' };
  }

  async getMe(userId: string): Promise<MeResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          where: { status: 'active' },
          include: {
            tenant: {
              select: { id: true, nameAr: true, nameEn: true, slug: true },
            },
            role: {
              select: { id: true, name: true, nameAr: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      tenantUsers: user.tenantUsers.map((tu) => ({
        id: tu.id,
        tenantId: tu.tenantId,
        roleId: tu.roleId,
        isOwner: tu.isOwner,
        tenant: tu.tenant,
        role: tu.role,
      })),
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    return this.mapUserResponse(updated);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const isCurrentValid = await compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    }

    const newPasswordHash = await hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.cacheService.setPasswordChangedAt(userId);

    return { message: 'تم تغيير كلمة المرور بنجاح' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const canProceed = await this.cacheService.checkForgotPasswordRateLimit(email);
    if (!canProceed) {
      throw new BadRequestException(
        'تم تجاوز الحد المسموح من طلبات إعادة التعيين. حاول مرة أخرى بعد ساعة',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (user) {
      const rawToken = v4();
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS);

      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          // V-24-audit-completion: tag the initiating flow so resetPassword
          // emits the right completion/failure audit (self_serve vs admin).
          initiatedBy: 'self_serve',
        },
      });

      const resetUrl = `${this.configService.get('APP_URL', 'http://localhost:3000')}/reset-password?token=${rawToken}`;

      await this.mailService.send({
        to: user.email,
        subject: 'إعادة تعيين كلمة المرور - SERVIX',
        body: `مرحباً ${user.fullName}،\n\nطلبتم إعادة تعيين كلمة المرور. استخدم الرابط التالي خلال ساعة:\n${resetUrl}\n\nإذا لم تطلبوا ذلك، تجاهلوا هذه الرسالة.`,
        html: `<p>مرحباً ${user.fullName}،</p><p>طلبتم إعادة تعيين كلمة المرور. <a href="${resetUrl}">اضغط هنا</a> خلال ساعة.</p><p>إذا لم تطلبوا ذلك، تجاهلوا هذه الرسالة.</p>`,
      });

      await this.smsService.send({
        to: user.phone,
        message: `SERVIX: تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدكم الإلكتروني`,
      });
    } else {
      // V-41: timing equalization. The found-user branch above takes
      // ~1-3 seconds (passwordReset.create + mailService.send +
      // smsService.send — all network I/O). Without this jitter the
      // not-found branch returns in ~10ms, letting an attacker enumerate
      // valid emails from a single request's response time. Range
      // 800-1500ms is matched to the typical observed mail+SMS p50 on
      // prod; sophisticated statistical analysis could still distinguish
      // (jitter doesn't perfectly mimic real-IO variance shape) but the
      // bar is raised from "single-request leak" to "needs N samples
      // and statistical analysis" — adequate for P2.
      //
      // crypto.randomInt (NOT Math.random) per V-13b's no-Math-random
      // ESLint rule — security-sensitive timing source.
      const jitterMs = randomInt(800, 1501); // [800, 1500] inclusive
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }

    await this.cacheService.incrementForgotPasswordAttempt(email);

    return {
      message:
        'إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور',
    };
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    if (!token?.trim()) {
      return { valid: false };
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: { select: { email: true } } },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return { valid: false };
    }

    return { valid: true, email: reset.user.email };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (!dto.token?.trim()) {
      throw new BadRequestException('رمز إعادة التعيين مطلوب');
    }

    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // V-24-self-serve-audit: an UNKNOWN token stays SILENT (no audit row) so
    // random token-probing can't spam the audit log. Once the row EXISTS, every
    // outcome (used / expired / completed) is audited under the prefix of the
    // flow that issued it: self_serve → auth_password_reset_*, admin →
    // admin_password_reset_*.
    if (!reset) {
      throw new BadRequestException('رمز إعادة التعيين غير صالح أو منتهي الصلاحية');
    }

    const auditPrefix = reset.initiatedBy === 'admin' ? 'admin' : 'auth';

    if (reset.usedAt) {
      await this.writeResetAudit(auditPrefix, 'failed', reset.userId, {
        reason: 'already_used',
        initiatedBy: reset.initiatedBy,
      });
      throw new BadRequestException('تم استخدام رمز إعادة التعيين مسبقاً');
    }
    if (reset.expiresAt < new Date()) {
      await this.writeResetAudit(auditPrefix, 'failed', reset.userId, {
        reason: 'expired',
        initiatedBy: reset.initiatedBy,
      });
      throw new BadRequestException('انتهت صلاحية رمز إعادة التعيين');
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // V-14a: invalidate any access/refresh token issued before this
    // reset. Without this, a leaked-then-reset password keeps the
    // attacker's session alive until the access token's natural
    // expiry (up to 15 min) — the entire reason the user is doing
    // a forgot-password flow in the first place.
    await this.cacheService.setPasswordChangedAt(reset.userId);

    // V-24-self-serve-audit: success trail. Pre-V-24 there was NONE — a
    // SOC2/PDPL gap, especially for self-serve resets which left no record at
    // all of who redeemed a token and when.
    await this.writeResetAudit(auditPrefix, 'completed', reset.userId, {
      initiatedBy: reset.initiatedBy,
    });

    return { message: 'تم إعادة تعيين كلمة المرور بنجاح' };
  }

  // V-24-self-serve-audit — emit a password-reset audit row. Best-effort: a
  // forensic-log hiccup must NEVER fail an already-committed reset (the password
  // change is the critical write; this row is forensic). Action prefix reflects
  // the initiating flow (auth_* self-serve / admin_* admin panel).
  private async writeResetAudit(
    prefix: 'auth' | 'admin',
    outcome: 'completed' | 'failed',
    userId: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService
      .log({
        userId,
        action: `${prefix}_password_reset_${outcome}`,
        entityType: 'User',
        entityId: userId,
        newValues,
      })
      .catch((e) =>
        this.logger.warn(
          `[reset-audit ${prefix}_${outcome}] ${(e as Error).message}`,
        ),
      );
  }

  // ══════════════ V-40a — Account self-unlock ══════════════
  //
  // Mitigates the V-25 lockout-as-DoS: an attacker who fails login 10× on a
  // known account locks the victim for 24h. Self-unlock lets the victim
  // recover immediately via an emailed link instead of waiting / contacting
  // support. (Reduces IMPACT only — the CAPTCHA half, V-40b, reduces
  // LIKELIHOOD and is gated; V-40 stays partially open.)

  async requestAccountUnlock(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const canProceed =
      await this.cacheService.checkAccountUnlockRateLimit(normalizedEmail);
    if (!canProceed) {
      throw new BadRequestException(
        'تم تجاوز الحد المسموح من طلبات فك القفل. حاول مرة أخرى بعد ساعة',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Act ONLY when the account exists AND is actually locked — but the
    // response is uniform either way (V-41 enumeration parity): we never
    // reveal existence or lock-state.
    if (user && (await this.cacheService.isAccountLocked(user.id))) {
      const rawToken = v4();
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await this.prisma.accountUnlock.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const unlockUrl = `${this.configService.get('APP_URL', 'http://localhost:3000')}/unlock-account?token=${rawToken}`;
      await this.mailService.send({
        to: user.email,
        subject: 'فك قفل الحساب - SERVIX',
        body: `مرحباً ${user.fullName}،\n\nطلبتم فك قفل حسابكم. استخدم الرابط التالي خلال ساعة:\n${unlockUrl}\n\nإذا لم تطلبوا ذلك، تجاهلوا هذه الرسالة (يبقى الحساب مقفلاً).`,
        html: `<p>مرحباً ${user.fullName}،</p><p>طلبتم فك قفل حسابكم. <a href="${unlockUrl}">اضغط هنا</a> خلال ساعة.</p><p>إذا لم تطلبوا ذلك، تجاهلوا هذه الرسالة.</p>`,
      });

      await this.auditService
        .log({
          userId: user.id,
          action: 'account_unlock_requested',
          entityType: 'User',
          entityId: user.id,
        });
    } else {
      // V-41 timing equalization: the act branch does a DB write + mail send;
      // jitter the no-op branch so response time can't distinguish
      // exists-and-locked from not. crypto.randomInt per V-13b.
      const jitterMs = randomInt(800, 1501);
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }

    await this.cacheService.incrementAccountUnlockAttempt(normalizedEmail);

    return {
      message: 'إذا كان الحساب مسجلاً ومقفلاً، ستصلك رسالة بفك القفل',
    };
  }

  async unlockAccount(token: string): Promise<{ message: string }> {
    if (!token?.trim()) {
      throw new BadRequestException('رمز فك القفل غير صالح أو منتهي الصلاحية');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const unlock = await this.prisma.accountUnlock.findUnique({
      where: { tokenHash },
    });

    // Unknown token → uniform error, NO audit row (anti-probing-spam;
    // V-24-audit-completion: only audit the completion/failure of a REAL,
    // existing unlock request).
    if (!unlock) {
      throw new BadRequestException('رمز فك القفل غير صالح أو منتهي الصلاحية');
    }

    if (unlock.expiresAt < new Date()) {
      await this.writeUnlockFailedAudit(unlock.userId, 'expired');
      throw new BadRequestException('انتهت صلاحية رمز فك القفل');
    }

    // Atomic single-use: only one concurrent request flips used_at from null.
    const consumed = await this.prisma.accountUnlock.updateMany({
      where: { id: unlock.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      await this.writeUnlockFailedAudit(unlock.userId, 'already_used');
      throw new BadRequestException('تم استخدام رمز فك القفل مسبقاً');
    }

    // Clear ONLY the account lock + its counter. IP-fail counters are left
    // intact on purpose — a brute-forcing IP stays blocked even after the
    // legitimate victim unlocks their own account.
    await this.cacheService.resetLoginFailAccount(unlock.userId);

    await this.auditService
      .log({
        userId: unlock.userId,
        action: 'account_unlock_completed',
        entityType: 'User',
        entityId: unlock.userId,
      });

    return { message: 'تم فك قفل الحساب بنجاح. يمكنك تسجيل الدخول الآن' };
  }

  private async writeUnlockFailedAudit(userId: string, reason: string): Promise<void> {
    await this.auditService
      .log({
        userId,
        action: 'account_unlock_failed',
        entityType: 'User',
        entityId: userId,
        newValues: { reason },
      });
  }

  // V-13c: hybrid token issuance.
  //   accessToken  = signed JWT (unchanged — 15min lifetime, JwtStrategy gates).
  //   refreshToken = opaque 32-byte hex (256 bits), persisted in refresh_tokens
  //     by SHA-256 hash. Raw value returned to the client once at issue time
  //     and never stored. Lookup-by-hash is what makes reuse detection
  //     possible (see refreshTokens above).
  //
  // opts:
  //   familyId  — passed by the refresh path to chain the successor row to
  //               the same family. Omitted by login/register/2FA/google/OTP
  //               paths — a fresh login starts a new family.
  //   ipAddress, userAgent — forensic columns. Currently only the /auth/refresh
  //               controller threads them; the other 5 callers leave them null.
  //               V-13c-forensics follow-up wires them up at issuance too.
  async generateTokens(
    payload: JwtPayload,
    opts: {
      familyId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {},
  ): Promise<JwtTokens> {
    const tokenPayload = {
      sub: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roleId: payload.roleId,
    };
    const accessSecret = this.configService.get<string>('jwt.accessSecret', '');
    const accessExpiration = this.configService.get(
      'jwt.accessExpiration',
      '15m',
    );
    const refreshExpirationSpec = this.configService.get<string>(
      'jwt.refreshExpiration',
      '7d',
    );

    const rawRefresh = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
    const familyId = opts.familyId ?? v4();
    const expiresAt = new Date(
      Date.now() + this.parseRefreshExpirySeconds(refreshExpirationSpec) * 1000,
    );

    const [accessToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: accessSecret,
        expiresIn: accessExpiration,
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: payload.sub,
          tokenHash,
          familyId,
          expiresAt,
          ipAddress: opts.ipAddress ?? null,
          userAgent: opts.userAgent ?? null,
        },
      }),
    ]);

    return { accessToken, refreshToken: rawRefresh };
  }

  // Parse expressions like '7d', '15m', '3600s', '24h'. Falls back to 7 days
  // on parse failure to match the legacy default. Standalone helper so the
  // refresh expiry doesn't pull in a dependency just for duration parsing.
  private parseRefreshExpirySeconds(spec: string): number {
    const SEVEN_DAYS = 7 * 24 * 3600;
    const m = /^(\d+)([smhd])$/.exec(spec.trim());
    if (!m) return SEVEN_DAYS;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 24 * 3600;
      default:
        return SEVEN_DAYS;
    }
  }

  // ══════════════ 2FA Login Verification ══════════════

  // V-25 / A2-09 — 2FA verify lockout parity.
  //
  // Pre-V-25, this endpoint was protected only by the controller's
  // @RateLimit(10, 60) decorator and accepted unlimited TOTP guesses
  // beyond that. Each guess also burned ~150ms of bcrypt CPU (the
  // password is re-verified per call), so failed attempts doubled as
  // a CPU DoS vector against the API.
  //
  // After V-25 the path mirrors login (auth.service.ts:212-271):
  //   1. IP-block gate          (fast-reject blocked IPs before any DB hit)
  //   2. User lookup
  //   3. Account-lock gate      (fast-reject locked accounts BEFORE bcrypt)
  //   4. bcrypt compare         (password verify)
  //   5. 2FA-enabled check
  //   6. TOTP verify
  //   7. fail/success counters  (shared with login per Phase A decision 1)
  //
  // Counters are shared with login (same Redis keyspace LOGIN_FAIL_IP_PREFIX
  // / LOGIN_FAIL_ACCOUNT_PREFIX) so an attacker pivoting from password-
  // brute-force to 2FA-brute-force on the same account accumulates against
  // the same threshold (LOGIN_ACCOUNT_LOCK_THRESHOLD = 10, 24h TTL). A
  // legitimate user typo-ing both their password (4×) and their TOTP (6×)
  // ends up locked at 10 — accepted trade-off for the cumulative attacker
  // tracking.
  //
  // All audit writes are fire-and-forget (.catch + logger.warn) — audit
  // slowness must never delay the hot path or surface as 500.
  async verify2FALogin(
    emailOrPhone: string,
    password: string,
    code: string,
    ip: string,
  ): Promise<{ user: any; tokens: JwtTokens }> {
    // 1️⃣ IP-block gate — fast-reject before any DB or bcrypt work.
    // No audit per-attempt here; the block itself was audited at trigger
    // time on the login path that originally crossed the threshold.
    const blockSeconds = await this.cacheService.checkLoginIpBlock(ip);
    if (blockSeconds > 0) {
      throw new UnauthorizedException(
        `تم تجاوز الحد المسموح من محاولات الدخول. حاول مرة أخرى بعد ${Math.ceil(blockSeconds / 60)} دقيقة`,
      );
    }

    // 2️⃣ User lookup.
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] },
    });
    if (!user) {
      // V-41: equalize timing with the wrong-password branch (line 925)
      // via dummy bcrypt. Same rationale as login (auth.service.ts:236-243).
      await compare(password, DUMMY_BCRYPT_HASH);
      // IP-only counter for unknown identifiers (parity with login).
      await this.cacheService.incrementLoginFailIp(ip);
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // 3️⃣ Account-lock gate — BEFORE bcrypt to save ~150ms of CPU on
    // locked accounts under a brute-force load.
    if (await this.cacheService.isAccountLocked(user.id)) {
      await this.auditService
        .log({
          userId: user.id,
          action: 'auth_2fa_verify_failed',
          entityType: 'User',
          entityId: user.id,
          newValues: { reason: 'account_locked' },
          ipAddress: ip,
        });
      throw new UnauthorizedException(
        'تم قفل الحساب بسبب محاولات دخول فاشلة متعددة. تواصل مع الدعم الفني',
      );
    }

    // 4️⃣ bcrypt password verify.
    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handle2FAFailure(user, ip, 'password_invalid');
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // 5️⃣ 2FA-enabled check — misconfigured account, NOT a credential
    // failure; do NOT increment counters (would allow an attacker to lock
    // out a user by disabling 2FA out-of-band then probing this endpoint).
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('التحقق الثنائي غير مفعل');
    }

    // 6️⃣ Code verify — V-42: route by format. A 6-digit code is a TOTP; any
    // other shape is treated as a backup (recovery) code. BOTH failure paths
    // go through handle2FAFailure, so a backup code can NEVER bypass the V-25
    // lockout that TOTP attempts are subject to.
    const isTotpFormat = /^\d{6}$/.test(code);
    const isCodeValid = isTotpFormat
      ? this.twoFactorService.verifyToken(user.twoFactorSecret, code)
      : await this.backupCodeService.verifyAndConsume(user.id, code);
    if (!isCodeValid) {
      await this.handle2FAFailure(
        user,
        ip,
        isTotpFormat ? 'code_invalid' : 'backup_code_invalid',
      );
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    // V-42: a consumed backup code is a security-relevant recovery event.
    if (!isTotpFormat) {
      const remainingCodes = await this.backupCodeService.countUnused(user.id);
      await this.auditService
        .log({
          userId: user.id,
          action: 'auth_2fa_backup_code_used',
          entityType: 'User',
          entityId: user.id,
          newValues: { ip, remainingCodes },
          ipAddress: ip,
        });
    }

    // 7️⃣ Success — reset both counters (parity with login.line:270-271).
    await this.cacheService.resetLoginFailIp(ip);
    await this.cacheService.resetLoginFailAccount(user.id);

    await this.auditService
      .log({
        userId: user.id,
        action: 'auth_2fa_verify_success',
        entityType: 'User',
        entityId: user.id,
        newValues: { ip },
        ipAddress: ip,
      });

    // V-14b-login: skip suspended tenants (see login()). The 2FA path issues a
    // JWT too, so it must pin to an active tenant for the same reason.
    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, status: 'active', tenant: { status: 'active' } },
      include: {
        tenant: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
        role: { select: { id: true, name: true, nameAr: true } },
      },
    });

    const firstTenantUser = tenantUsers[0];
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: firstTenantUser?.tenantId ?? '',
      roleId: firstTenantUser?.roleId ?? '',
    });

    return {
      user: this.mapUserResponse(user),
      tokens,
    };
  }

  // V-25: shared fail handler for both password-invalid and code-invalid
  // paths inside verify2FALogin. Increments BOTH counters (IP + account),
  // mirrors login.line:251-265 — including the SMS notification on the
  // lock-transition. Audit row carries the failure reason so post-incident
  // analysis can distinguish password brute-force from code brute-force.
  private async handle2FAFailure(
    user: { id: string; phone: string },
    ip: string,
    reason: 'password_invalid' | 'code_invalid' | 'backup_code_invalid',
  ): Promise<void> {
    const ipResult = await this.cacheService.incrementLoginFailIp(ip);
    const accResult = await this.cacheService.incrementLoginFailAccount(user.id);

    await this.auditService
      .log({
        userId: user.id,
        action: 'auth_2fa_verify_failed',
        entityType: 'User',
        entityId: user.id,
        newValues: {
          reason,
          ipFailCount: ipResult.count,
          ipBlockSeconds: ipResult.blockSeconds,
          accountFailCount: accResult.count,
          accountLocked: accResult.locked,
        },
        ipAddress: ip,
      });

    if (accResult.locked) {
      // Lockout transition — fire SMS + lockout audit row. Both are
      // transition-only (incrementLoginFailAccount returns locked=true ONLY
      // when count crosses the threshold), so user receives at most 1 SMS
      // per 24h lockout cycle even under sustained brute-force.
      await this.smsService.send({
        to: user.phone,
        message:
          'SERVIX: تم قفل حسابك بسبب محاولات دخول فاشلة. تواصل مع الدعم الفني',
      }).catch((e) => this.logger.warn(`[2fa-lockout SMS] ${(e as Error).message}`));

      await this.auditService
        .log({
          userId: user.id,
          action: 'auth_2fa_lockout_triggered',
          entityType: 'User',
          entityId: user.id,
          newValues: {
            triggeringReason: reason,
            accountFailCount: accResult.count,
            lockoutTtlSeconds: 24 * 60 * 60,
          },
          ipAddress: ip,
        });
    }
  }

  // ══════════════ 2FA Methods ══════════════

  async setup2FA(userId: string): Promise<{ secret: string; otpAuthUrl: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const secret = this.twoFactorService.generateSecret();
    const otpAuthUrl = this.twoFactorService.generateOtpAuthUrl(user.email, secret);
    const backupCodes = this.twoFactorService.generateBackupCodes();

    // Store the secret temporarily (not enabled yet until verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    // V-42: persist the (hashed) backup codes so the codes shown here are the
    // ones that work for recovery. Inert until 2FA is enabled — verifyAndConsume
    // is only reachable through verify2FALogin, which requires twoFactorEnabled.
    await this.backupCodeService.store(userId, backupCodes);

    return { secret, otpAuthUrl, backupCodes };
  }

  async verify2FA(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (!user.twoFactorSecret) throw new BadRequestException('لم يتم إعداد التحقق الثنائي');

    const isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, code);
    if (!isValid) throw new BadRequestException('رمز التحقق غير صحيح');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { message: 'تم تفعيل التحقق الثنائي بنجاح' };
  }

  async disable2FA(userId: string, password: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) throw new BadRequestException('كلمة المرور غير صحيحة');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    // V-42: drop backup codes too — no stale recovery vector after disable.
    await this.backupCodeService.deleteAll(userId);

    return { message: 'تم إلغاء التحقق الثنائي' };
  }

  async get2FAStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return { enabled: user.twoFactorEnabled };
  }

  // V-42: rotate backup codes. Requires a valid CURRENT TOTP (defense-in-depth
  // — a hijacked session alone must not be able to silently replace recovery
  // codes). store() invalidates the old set (delete + insert) atomically.
  async regenerateBackupCodes(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('التحقق الثنائي غير مفعل');
    }
    if (!this.twoFactorService.verifyToken(user.twoFactorSecret, code)) {
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    const backupCodes = this.twoFactorService.generateBackupCodes();
    await this.backupCodeService.store(userId, backupCodes);

    await this.auditService
      .log({
        userId,
        action: 'auth_2fa_backup_codes_regenerated',
        entityType: 'User',
        entityId: userId,
        newValues: { count: backupCodes.length },
      });

    return { backupCodes };
  }

  // ══════════════ Google OAuth ══════════════

  // V-13a / A2-03 — Google OAuth account-takeover prevention.
  //
  // Pre-V-13a the flow silently linked a Google identity to any existing user
  // whose email matched the Google profile's email — a textbook OAuth account
  // takeover (attacker controls Google account for victim's email → presents
  // valid idToken → SERVIX stamps attacker's googleId onto victim's row and
  // issues attacker tokens, victim's password keeps working but every future
  // /auth/google call from the attacker logs in as the victim).
  //
  // After V-13a the gate is strict:
  //   1. Match by googleId → return tokens (returning user, no row mutation).
  //   2. Match by email only → REJECT. Emit auth_google_takeover_blocked audit
  //      row. Force the user to sign in with their password and use the new
  //      POST /auth/link-google endpoint from an authenticated session.
  //   3. No match → create a fresh GOOGLE-only user (no password, isEmailVerified
  //      mirrors profile.email_verified — workspace accounts can be false).
  async googleLogin(idToken: string) {
    const googleUser = await this.googleAuthService.verifyIdToken(idToken);

    // Match by googleId FIRST — the authoritative join. Email lookup is only
    // consulted to detect the takeover-attempt case (path 2 above).
    const userByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: googleUser.sub },
    });

    let user = userByGoogleId;

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (existingByEmail) {
        // 🚨 Takeover attempt blocked. Forensic audit before throwing —
        // the existingUser.id is the *victim*; tracking this user lets ops
        // detect "same victim, multiple attempts" patterns. Best-effort
        // (fire-and-forget catch) — audit failure must not surface as 500.
        await this.auditService
          .log({
            userId: existingByEmail.id,
            action: 'auth_google_takeover_blocked',
            entityType: 'User',
            entityId: existingByEmail.id,
            newValues: {
              attemptedEmail: googleUser.email,
              googleSub: googleUser.sub,
              existingUserAuthProvider: existingByEmail.authProvider,
              existingUserHasGoogleId: !!existingByEmail.googleId,
              reason: 'email_match_without_googleId',
            },
          });

        throw new UnauthorizedException(
          'يوجد حساب مسجَّل بهذا البريد. سجّل الدخول بكلمة المرور أولاً، ثم اربط حساب Google من الإعدادات.',
        );
      }

      // Fresh user — Google-first registration.
      user = await this.prisma.user.create({
        data: {
          fullName: googleUser.name,
          email: googleUser.email,
          phone: `g-${googleUser.sub.slice(0, 10)}`, // V-13a-phone-placeholder follow-up
          passwordHash: await hash(v4(), BCRYPT_ROUNDS), // unusable bcrypt
          avatarUrl: googleUser.picture || null,
          googleId: googleUser.sub,
          authProvider: AUTH_PROVIDERS.GOOGLE,
          isEmailVerified: googleUser.email_verified,
        },
      });
    }

    // Success path (matched-by-googleId OR fresh-create). Audit the login so
    // we have parity with auth.login's audit row at register/login paths.
    //
    // Defense-in-depth snapshot: email + authProvider are persisted in
    // newValues even though they could be JOINed from users at query time.
    // Reason: future email-change endpoints (planned in V-13a-frontend)
    // would mutate users.email, breaking the audit-timeline reconstruction
    // for "which email was on this account at the moment of login".
    await this.auditService
      .log({
        userId: user.id,
        action: 'auth_google_login',
        entityType: 'User',
        entityId: user.id,
        newValues: {
          googleSub: googleUser.sub,
          email: user.email,
          authProvider: user.authProvider,
          isNewUser: !userByGoogleId,
        },
      });

    // Get tenant associations
    // V-14b-login: skip suspended tenants (see login()). The Google path issues
    // a JWT too, so it must pin to an active tenant for the same reason.
    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, status: 'active', tenant: { status: 'active' } },
      include: {
        tenant: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
        role: { select: { id: true, name: true, nameAr: true } },
      },
    });

    const firstTenantUser = tenantUsers[0];
    const tokens = firstTenantUser
      ? await this.generateTokens({
          sub: user.id,
          email: user.email,
          tenantId: firstTenantUser.tenantId,
          roleId: firstTenantUser.roleId,
        })
      : await this.generateTokens({
          sub: user.id,
          email: user.email,
          tenantId: '',
          roleId: '',
        });

    return {
      user: this.mapUserResponse(user),
      tenants: tenantUsers.map((tu) => ({
        id: tu.id,
        tenantId: tu.tenantId,
        roleId: tu.roleId,
        isOwner: tu.isOwner,
        tenant: tu.tenant,
        role: tu.role,
      })),
      tokens,
      isNewUser: tenantUsers.length === 0,
    };
  }

  // V-13a / A2-03 — explicit Google linking from an authenticated session.
  // The complement to googleLogin's takeover-block path: users who already
  // have a LOCAL account follow login-with-password → settings →
  // "Link Google" → this endpoint. The auth boundary is the JWT (controller
  // applies the default JwtAuthGuard); we trust req.user.sub as identity.
  //
  // Gates:
  //   - idToken's email MUST match the JWT user's email (400 otherwise).
  //     Defends against a malicious extension feeding a wrong-account
  //     idToken to a logged-in victim.
  //   - googleId MUST NOT already be linked to a different user. Enforced
  //     atomically via the @unique constraint catching Prisma P2002 (avoids
  //     the findUnique-then-update race window).
  async linkGoogle(userId: string, idToken: string): Promise<{ message: string }> {
    const googleUser = await this.googleAuthService.verifyIdToken(idToken);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // The JWT was validated, but the row was deleted between token issue
      // and now. Treat as 401 — no point letting them link an account whose
      // identity has been removed.
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    if (googleUser.email !== user.email) {
      throw new BadRequestException(
        'البريد الإلكتروني في حساب Google لا يطابق بريد حسابك.',
      );
    }

    if (user.googleId === googleUser.sub) {
      // Idempotent: re-linking the same Google identity is a no-op success.
      return { message: 'حساب Google مربوط بالفعل.' };
    }

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.sub,
          authProvider: AUTH_PROVIDERS.BOTH,
        },
      });
    } catch (err) {
      // Race-free uniqueness check: Prisma P2002 fires when googleId UNIQUE
      // would be violated (= googleId is already linked to a different user).
      if (
        typeof err === 'object' && err !== null && 'code' in err &&
        (err as { code: unknown }).code === 'P2002'
      ) {
        throw new ConflictException(
          'حساب Google مربوط بمستخدم آخر بالفعل.',
        );
      }
      throw err;
    }

    await this.auditService
      .log({
        userId: user.id,
        action: 'auth_google_linked',
        entityType: 'User',
        entityId: user.id,
        newValues: {
          googleSub: googleUser.sub,
          previousAuthProvider: user.authProvider,
          newAuthProvider: AUTH_PROVIDERS.BOTH,
        },
      });

    return { message: 'تم ربط حساب Google بنجاح.' };
  }

  // V-13a-unlink — remove a Google link from the current account.
  //   * No googleId            → idempotent no-op (nothing to unlink).
  //   * authProvider === GOOGLE → REFUSE: a pure-Google account has no usable
  //     password (a random hash satisfies NOT NULL), so unlinking would lock
  //     the user out. They must set a password first.
  //   * otherwise (BOTH)        → revert to LOCAL; the password remains usable.
  async unlinkGoogle(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }
    if (!user.googleId) {
      return { message: 'لا يوجد حساب Google مربوط.' };
    }
    if (user.authProvider === AUTH_PROVIDERS.GOOGLE) {
      throw new BadRequestException(
        'عيّن كلمة مرور أولاً قبل إلغاء ربط حساب Google.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: null,
        authProvider: AUTH_PROVIDERS.LOCAL,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'auth_google_unlinked',
      entityType: 'User',
      entityId: user.id,
      newValues: {
        previousAuthProvider: user.authProvider,
        newAuthProvider: AUTH_PROVIDERS.LOCAL,
      },
    });

    return { message: 'تم إلغاء ربط حساب Google.' };
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private mapUserResponse(user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
  }): UserResponse {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
    };
  }

  // ══════════════ Email OTP Verification ══════════════

  private generateOtpCode(): string {
    // V-13b: crypto.randomInt(min, max) — max is exclusive, so the
    // range 100000..999999 inclusive is [100000, 1_000_000). All values
    // are 6 digits by construction (no leading-zero padding needed).
    return randomInt(100000, 1_000_000).toString();
  }

  private async sendEmailOtpInternal(email: string, fullName: string): Promise<void> {
    const canSend = await this.cacheService.canSendEmailOtp(email);
    if (!canSend) {
      this.logger.log(`[OTP] Rate limited — skipping OTP for ${email}`);
      return;
    }

    const code = this.generateOtpCode();
    await this.cacheService.setEmailOtp(email, code);
    await this.cacheService.markEmailOtpSent(email);

    this.logger.log(`[OTP] Sending verification code to ${email}`);

    await this.mailService.send({
      to: email,
      subject: 'رمز التحقق — SERVIX',
      body: `مرحباً ${fullName}،\n\nرمز التحقق الخاص بك هو: ${code}\n\nصالح لمدة 10 دقائق.\n\nإذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.`,
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #1f2937; margin: 0;">SERVIX</h2>
            <p style="color: #6b7280; margin: 4px 0 0;">رمز التحقق</p>
          </div>
          <div style="background: white; border-radius: 8px; padding: 24px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">مرحباً ${fullName}،</p>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7c3aed;">${code}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0;">صالح لمدة 10 دقائق</p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
        </div>
      `,
    });
  }

  async verifyEmailOtp(email: string, code: string): Promise<{
    user: UserResponse;
    tenants: TenantWithRole[];
    tokens: JwtTokens;
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    const isValid = await this.cacheService.verifyEmailOtp(normalizedEmail, code);
    if (!isValid) {
      throw new BadRequestException('رمز التحقق غير صحيح أو منتهي الصلاحية');
    }

    // Mark email as verified
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });

    this.logger.log(`[OTP] Email verified for user ${user.id} (${user.email})`);

    // Provision tenant database for pending tenants (created during registration)
    const pendingTenantUsers = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, isOwner: true },
      include: { tenant: true },
    });

    for (const tu of pendingTenantUsers) {
      if (tu.tenant.status === 'pending') {
        await this.provisionTenantAfterVerification(tu.tenant);
      }
    }

    // Get tenant associations
    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, status: 'active' },
      include: {
        tenant: {
          select: { id: true, nameAr: true, nameEn: true, slug: true },
        },
        role: {
          select: { id: true, name: true, nameAr: true },
        },
      },
    });

    const firstTenantUser = tenantUsers[0];
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: firstTenantUser?.tenantId ?? '',
      roleId: firstTenantUser?.roleId ?? '',
    });

    // Audit log: email verified. V-35b — awaited fail-loud (no silent swallow);
    // see the login-audit note above for why this adds no new failure mode.
    await this.auditService.log({
      userId: user.id,
      tenantId: firstTenantUser?.tenantId,
      action: 'auth.email_verified',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email },
    });

    return {
      user: this.mapUserResponse(user),
      tenants: tenantUsers.map((tu) => ({
        id: tu.id,
        tenantId: tu.tenantId,
        roleId: tu.roleId,
        isOwner: tu.isOwner,
        tenant: tu.tenant,
        role: tu.role,
      })),
      tokens,
    };
  }

  private async provisionTenantAfterVerification(tenant: {
    id: string;
    databaseName: string;
    status: string;
  }): Promise<void> {
    const TRIAL_DAYS = 14;
    this.logger.log(`[Provision] Starting tenant provisioning for ${tenant.id} (${tenant.databaseName})`);

    // Find Basic plan for trial subscription
    const basicPlan = await this.prisma.plan.findFirst({
      where: { name: 'Basic', isActive: true },
    });
    if (!basicPlan) {
      this.logger.error('[Provision] Basic plan not found');
      throw new InternalServerErrorException(
        'خطأ في النظام: لم يتم العثور على خطة الاشتراك الأساسية',
      );
    }

    // Create the tenant's isolated database
    try {
      await this.tenantDatabaseService.createTenantDatabase(tenant.databaseName);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Provision] Failed to create tenant database ${tenant.databaseName}: ${errMsg}`);
      throw new InternalServerErrorException(
        'فشل إنشاء قاعدة بيانات الصالون. يرجى المحاولة لاحقاً.',
      );
    }

    // Activate tenant: set status to trial + create subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { status: 'trial', trialEndsAt: trialEnd },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: basicPlan.id,
          status: 'trial',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
        },
      });
    });

    this.logger.log(`[Provision] Tenant ${tenant.id} provisioned successfully — trial ends ${trialEnd.toISOString()}`);
  }

  async resendEmailOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // V-41b / A2-?? — enumeration hardening on /auth/resend-otp.
    // The pre-V-41b code returned 4 distinct outcomes (generic / "already
    // verified" / 400 "wait 60s" / "code sent"), so response BODY *and* HTTP
    // STATUS leaked whether the email existed and its verification state.
    // V-41 closed the same channel on login + forgotPassword; this brings
    // resend-otp to parity (Option A — full uniformity):
    //   * ONE generic 200 body on every path (below);
    //   * real work happens ONLY for an existing, not-yet-verified account
    //     that is outside the per-email 60s resend cooldown;
    //   * every other path (unknown email / already verified / cooldown
    //     active) takes the SAME jittered time so single-request latency
    //     can't distinguish them either.
    // Residual: the actionable send branch does real mail I/O (~1-3s) vs the
    // jittered branches (800-1500ms) — same accepted P2 residual as
    // forgotPassword (needs N samples + statistical analysis, not a single
    // request). Controller @RateLimit(3,60) (IP-based, existence-independent)
    // still caps raw flooding. UX cost: the "already verified" / "wait 60s"
    // hints are gone — accepted for the enumeration win.
    if (
      user &&
      !user.isEmailVerified &&
      (await this.cacheService.canSendEmailOtp(normalizedEmail))
    ) {
      await this.sendEmailOtpInternal(user.email, user.fullName);
    } else {
      // crypto.randomInt (NOT Math.random) per V-13b's no-Math-random rule;
      // range matched to the send branch's mail p50.
      const jitterMs = randomInt(800, 1501); // [800, 1500] inclusive
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }

    return {
      message: 'إذا كان البريد مسجلاً وغير مُؤكد، فسيصلك رمز تحقق جديد',
    };
  }
}
