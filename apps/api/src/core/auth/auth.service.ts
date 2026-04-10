import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
import { TwoFactorService } from './two-factor.service';
import { GoogleAuthService } from './google-auth.service';
import { AuditService } from '../audit/audit.service';

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

    // Audit log: registration (fire-and-forget)
    this.auditService.log({
      tenantId: result.tenant.id,
      userId: result.user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: result.user.id,
      newValues: { email: result.user.email, tenantSlug: result.tenant.slug },
    }).catch(() => {});

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

    // Audit log: successful login (fire-and-forget)
    this.auditService.log({
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      newValues: { ip },
    }).catch(() => {});

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

  // ══════════════ 2FA Login Verification ══════════════

  async verify2FALogin(
    emailOrPhone: string,
    password: string,
    code: string,
    ip: string,
  ): Promise<{ user: any; tokens: JwtTokens }> {
    // Re-authenticate
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] },
    });
    if (!user) throw new UnauthorizedException('بيانات الدخول غير صحيحة');

    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('بيانات الدخول غير صحيحة');

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('التحقق الثنائي غير مفعل');
    }

    const isCodeValid = this.twoFactorService.verifyToken(user.twoFactorSecret, code);
    if (!isCodeValid) throw new BadRequestException('رمز التحقق غير صحيح');

    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, status: 'active' },
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

  // ══════════════ Google OAuth ══════════════

  async googleLogin(idToken: string) {
    const googleUser = await this.googleAuthService.verifyIdToken(idToken);

    // Check if user already exists by googleId or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.sub },
          { email: googleUser.email },
        ],
      },
    });

    if (user) {
      // Link Google account if not already linked
      if (!user.googleId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.sub, authProvider: 'google' },
        });
      }
    } else {
      // Auto-register new user from Google
      user = await this.prisma.user.create({
        data: {
          fullName: googleUser.name,
          email: googleUser.email,
          phone: `g-${googleUser.sub.slice(0, 10)}`, // placeholder phone
          passwordHash: await hash(v4(), BCRYPT_ROUNDS), // random password
          avatarUrl: googleUser.picture || null,
          googleId: googleUser.sub,
          authProvider: 'google',
          isEmailVerified: googleUser.email_verified,
        },
      });
    }

    // Get tenant associations
    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, status: 'active' },
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
    return Math.floor(100000 + Math.random() * 900000).toString();
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

    // Audit log
    this.auditService.log({
      userId: user.id,
      tenantId: firstTenantUser?.tenantId,
      action: 'auth.email_verified',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email },
    }).catch(() => {});

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
    if (!user) {
      // Don't reveal if email exists
      return { message: 'إذا كان البريد مسجلاً، سيتم إرسال رمز تحقق جديد' };
    }

    if (user.isEmailVerified) {
      return { message: 'البريد الإلكتروني مُؤكد بالفعل' };
    }

    const canSend = await this.cacheService.canSendEmailOtp(normalizedEmail);
    if (!canSend) {
      throw new BadRequestException('يرجى الانتظار 60 ثانية قبل إعادة الإرسال');
    }

    await this.sendEmailOtpInternal(user.email, user.fullName);

    return { message: 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني' };
  }
}
