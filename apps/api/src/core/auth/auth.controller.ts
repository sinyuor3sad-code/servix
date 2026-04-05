import {
  Body,
  Controller,
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
  constructor(private readonly authService: AuthService) {}

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
    tokens: JwtTokens;
  }> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    return this.authService.login(dto, ip);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'التحقق من رمز OTP (غير متاح حالياً)' })
  @ApiResponse({ status: 200, description: 'تم التحقق بنجاح' })
  async verifyOtp(): Promise<{ message: string }> {
    return { message: 'ميزة التحقق بـ OTP ستكون متاحة قريباً' };
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
}
