import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { v4 } from 'uuid';
import { createHash } from 'crypto';
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
  tenants: TenantWithRole[];
  tokens: JwtTokens;
}

interface LoginResult {
  user: UserResponse;
  tenants: TenantWithRole[];
  tokens: JwtTokens;
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

const RESET_TOKEN_EXPIRY_HOURS = 1;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly tenantDatabaseService: TenantDatabaseService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    console.log(`[AuthService.register] Starting registration for email=${dto.email}`);

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

    // Find the Basic plan for trial subscription
    const basicPlan = await this.prisma.plan.findFirst({
      where: { name: 'Basic', isActive: true },
    });
    if (!basicPlan) {
      console.error('[AuthService.register] Basic plan not found — cannot create trial subscription');
      throw new InternalServerErrorException(
        'خطأ في النظام: لم يتم العثور على خطة الاشتراك الأساسية',
      );
    }

    const TRIAL_DAYS = 14;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });
      console.log(`[AuthService.register] Created user id=${user.id}`);

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

      const tenant = await tx.tenant.create({
        data: {
          nameAr: dto.salonNameAr,
          nameEn: dto.salonNameEn ?? dto.salonNameAr,
          slug,
          databaseName,
          status: 'trial',
          trialEndsAt: trialEnd,
        },
      });
      console.log(`[AuthService.register] Created tenant id=${tenant.id}, slug=${slug}`);

      const tenantUser = await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: ownerRole.id,
          isOwner: true,
        },
      });
      console.log(`[AuthService.register] Created tenantUser id=${tenantUser.id}, roleId=${ownerRole.id}`);

      // Create trial subscription so TenantMiddleware allows access
      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: basicPlan.id,
          status: 'trial',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
        },
      });
      console.log(`[AuthService.register] Created trial subscription id=${subscription.id}, ends=${trialEnd.toISOString()}`);

      return { user, tenant };
    });

    // Create the tenant's isolated PostgreSQL database and push schema
    try {
      await this.tenantDatabaseService.createTenantDatabase(databaseName);
    } catch (error: unknown) {
      // Log but don't fail registration — database can be retried
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create tenant database ${databaseName}: ${errMsg}`);
    }

    const tokens = await this.generateTokens({
      sub: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
      roleId: ownerRole.id,
    });

    const tenantResponse: TenantResponse = {
      id: result.tenant.id,
      nameAr: result.tenant.nameAr,
      nameEn: result.tenant.nameEn,
      slug: result.tenant.slug,
    };

    return {
      user: this.mapUserResponse(result.user),
      tenant: tenantResponse,
      tenants: [
        {
          id: result.user.id,
          tenantId: result.tenant.id,
          roleId: ownerRole.id,
          isOwner: true,
          tenant: tenantResponse,
          role: {
            id: ownerRole.id,
            name: ownerRole.name,
            nameAr: ownerRole.nameAr,
          },
        },
      ],
      tokens,
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
      await this.cacheService.incrementLoginFailIp(ip);
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
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

    if (tenantUsers.length === 0) {
      throw new UnauthorizedException(
        'لا يوجد لديك صالون مرتبط. تواصل مع الدعم الفني',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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
    };
  }

  async refreshTokens(refreshToken: string): Promise<JwtTokens> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const blacklisted = await this.cacheService.isRefreshTokenBlacklisted(tokenHash);
    if (blacklisted) {
      throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي الصلاحية');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload & { iat?: number }>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const pwdChangedAt = await this.cacheService.getPasswordChangedAt(payload.sub);
      if (pwdChangedAt && payload.iat && payload.iat * 1000 < pwdChangedAt) {
        throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي الصلاحية');
      }

      return this.generateTokens({
        sub: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        roleId: payload.roleId,
      });
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'رمز التحديث غير صالح أو منتهي الصلاحية',
      );
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    if (refreshToken?.trim()) {
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      await this.cacheService.blacklistRefreshToken(tokenHash);
    }
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
          token: tokenHash,
          expiresAt,
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
      where: { token: tokenHash },
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
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!reset) {
      throw new BadRequestException('رمز إعادة التعيين غير صالح أو منتهي الصلاحية');
    }
    if (reset.usedAt) {
      throw new BadRequestException('تم استخدام رمز إعادة التعيين مسبقاً');
    }
    if (reset.expiresAt < new Date()) {
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

    return { message: 'تم إعادة تعيين كلمة المرور بنجاح' };
  }

  async generateTokens(payload: JwtPayload): Promise<JwtTokens> {
    const tokenPayload = { sub: payload.sub, email: payload.email, tenantId: payload.tenantId, roleId: payload.roleId };
    const accessSecret = this.configService.get<string>('jwt.accessSecret', '');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret', '');
    const accessExpiration = this.configService.get('jwt.accessExpiration', '15m');
    const refreshExpiration = this.configService.get('jwt.refreshExpiration', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: accessSecret,
        expiresIn: accessExpiration,
      }),
      this.jwtService.signAsync(tokenPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiration,
      }),
    ]);

    return { accessToken, refreshToken };
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
}
