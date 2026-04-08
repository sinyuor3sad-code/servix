import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayload, JwtTokens } from '../../shared/types';
import { CurrentUser, Public } from '../../shared/decorators';
import { RateLimit } from '../../shared/guards/rate-limit.guard';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { GoogleAuthService } from './google-auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  @Post('register')
  @Public()
  @RateLimit(5, 60)
  @ApiOperation({ summary: 'تسجيل مستخدم جديد وإنشاء صالون' })
  @ApiResponse({ status: 201, description: 'تم التسجيل بنجاح' })
  @ApiResponse({ status: 409, description: 'البريد الإلكتروني أو رقم الجوال مسجل مسبقاً' })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{
    user: { id: string; fullName: string; email: string; phone: string; avatarUrl: string | null };
    tenant: { id: string; nameAr: string; nameEn: string; slug: string };
    requiresVerification: boolean;
    message: string;
  }> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الدخول بالبريد الإلكتروني أو رقم الجوال' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الدخول بنجاح' })
  @ApiResponse({ status: 401, description: 'بيانات الدخول غير صحيحة' })
  @ApiResponse({ status: 429, description: 'تم تجاوز الحد المسموح من المحاولات' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<{
    user: { id: string; fullName: string; email: string; phone: string; avatarUrl: string | null };
    tenants: Array<{
      id: string;
      tenantId: string;
      roleId: string;
      isOwner: boolean;
      tenant: { id: string; nameAr: string; nameEn: string; slug: string };
      role: { id: string; name: string; nameAr: string };
    }>;
    tokens: JwtTokens | null;
    requires2FA: boolean;
  }> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    return this.authService.login(dto, ip);
  }

  @Post('2fa/verify-login')
  @Public()
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'التحقق الثنائي بعد تسجيل الدخول' })
  async verify2FALogin(
    @Body() body: { emailOrPhone: string; password: string; code: string },
    @Req() req: Request,
  ): Promise<{
    user: { id: string; fullName: string; email: string; phone: string; avatarUrl: string | null };
    tokens: JwtTokens;
  }> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    return this.authService.verify2FALogin(body.emailOrPhone, body.password, body.code, ip);
  }

  @Post('refresh')
  @Public()
  @RateLimit(20, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تحديث رمز الوصول باستخدام رمز التحديث' })
  @ApiResponse({ status: 200, description: 'تم تحديث الرمز بنجاح' })
  @ApiResponse({ status: 401, description: 'رمز التحديث غير صالح أو منتهي الصلاحية' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<JwtTokens> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الخروج' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الخروج بنجاح' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  @RateLimit(5, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'طلب إعادة تعيين كلمة المرور' })
  @ApiResponse({ status: 200, description: 'تم إرسال رابط إعادة التعيين إذا كان البريد مسجلاً' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @RateLimit(5, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إعادة تعيين كلمة المرور باستخدام رمز التعيين' })
  @ApiResponse({ status: 200, description: 'تم إعادة تعيين كلمة المرور بنجاح' })
  @ApiResponse({ status: 400, description: 'رمز إعادة التعيين غير صالح أو منتهي' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-reset-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'التحقق من صلاحية رمز إعادة التعيين' })
  @ApiResponse({ status: 200, description: 'صالح أو غير صالح' })
  async verifyResetToken(
    @Body() body: { token: string },
  ): Promise<{ valid: boolean; email?: string }> {
    return this.authService.verifyResetToken(body.token);
  }

  @Post('verify-otp')
  @Public()
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'التحقق من رمز OTP المرسل للبريد الإلكتروني' })
  @ApiResponse({ status: 200, description: 'تم التحقق بنجاح — يُعيد tokens' })
  @ApiResponse({ status: 400, description: 'رمز التحقق غير صحيح أو منتهي' })
  async verifyOtp(
    @Body() body: { email: string; code: string },
  ): Promise<{
    user: { id: string; fullName: string; email: string; phone: string; avatarUrl: string | null };
    tenants: Array<{
      id: string;
      tenantId: string;
      roleId: string;
      isOwner: boolean;
      tenant: { id: string; nameAr: string; nameEn: string; slug: string };
      role: { id: string; name: string; nameAr: string };
    }>;
    tokens: JwtTokens;
  }> {
    return this.authService.verifyEmailOtp(body.email, body.code);
  }

  @Post('resend-otp')
  @Public()
  @RateLimit(3, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إعادة إرسال رمز التحقق للبريد الإلكتروني' })
  @ApiResponse({ status: 200, description: 'تم إرسال رمز جديد' })
  @ApiResponse({ status: 400, description: 'يرجى الانتظار قبل إعادة الإرسال' })
  async resendOtp(
    @Body() body: { email: string },
  ): Promise<{ message: string }> {
    return this.authService.resendEmailOtp(body.email);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'الحصول على بيانات المستخدم الحالي مع صالوناته' })
  @ApiResponse({ status: 200, description: 'بيانات المستخدم الحالي' })
  @ApiResponse({ status: 401, description: 'غير مصرح بالوصول' })
  async getMe(
    @CurrentUser('sub') userId: string,
  ): Promise<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
    tenantUsers: Array<{
      id: string;
      tenantId: string;
      roleId: string;
      isOwner: boolean;
      tenant: { id: string; nameAr: string; nameEn: string; slug: string };
      role: { id: string; name: string; nameAr: string };
    }>;
  }> {
    return this.authService.getMe(userId);
  }

  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تحديث الملف الشخصي للمستخدم الحالي' })
  @ApiResponse({ status: 200, description: 'تم تحديث الملف الشخصي بنجاح' })
  @ApiResponse({ status: 401, description: 'غير مصرح بالوصول' })
  async updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
  }> {
    return this.authService.updateMe(userId, dto);
  }

  @Put('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تغيير كلمة المرور' })
  @ApiResponse({ status: 200, description: 'تم تغيير كلمة المرور بنجاح' })
  @ApiResponse({ status: 400, description: 'كلمة المرور الحالية غير صحيحة' })
  @ApiResponse({ status: 401, description: 'غير مصرح بالوصول' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(userId, dto);
  }

  // ════════════ 2FA Endpoints ════════════

  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تفعيل التحقق الثنائي — يُعيد secret + QR URL' })
  async setup2FA(
    @CurrentUser('sub') userId: string,
  ): Promise<{ secret: string; otpAuthUrl: string; backupCodes: string[] }> {
    return this.authService.setup2FA(userId);
  }

  @Post('2fa/verify')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأكيد تفعيل التحقق الثنائي بالرمز' })
  async verify2FA(
    @CurrentUser('sub') userId: string,
    @Body() body: { code: string },
  ): Promise<{ message: string }> {
    return this.authService.verify2FA(userId, body.code);
  }

  @Delete('2fa')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إلغاء التحقق الثنائي' })
  async disable2FA(
    @CurrentUser('sub') userId: string,
    @Body() body: { password: string },
  ): Promise<{ message: string }> {
    return this.authService.disable2FA(userId, body.password);
  }

  @Get('2fa/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حالة التحقق الثنائي' })
  async get2FAStatus(
    @CurrentUser('sub') userId: string,
  ): Promise<{ enabled: boolean }> {
    return this.authService.get2FAStatus(userId);
  }

  // ════════════ Google OAuth ════════════

  @Post('google')
  @Public()
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الدخول بحساب Google' })
  async googleLogin(
    @Body() body: { idToken: string },
  ) {
    return this.authService.googleLogin(body.idToken);
  }

  @Get('google/status')
  @Public()
  @ApiOperation({ summary: 'هل Google OAuth مُفعّل؟' })
  googleStatus(): { enabled: boolean } {
    return { enabled: this.googleAuthService.isEnabled() };
  }
}
