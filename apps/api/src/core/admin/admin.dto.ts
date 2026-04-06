import {
  IsOptional,
  IsString,
  IsInt,
  IsEmail,
  IsNotEmpty,
  Min,
  Max,
  IsIn,
  IsUUID,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdminLoginDto {
  @ApiProperty({ description: 'البريد الإلكتروني', example: 'admin@servi-x.com' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;

  @ApiProperty({ description: 'كلمة المرور' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  password: string;
}

const TENANT_STATUSES = ['active', 'suspended'] as const;
type TenantStatusFilter = (typeof TENANT_STATUSES)[number];

const TENANT_ALL_STATUSES = ['active', 'suspended', 'trial', 'cancelled'] as const;
type TenantAllStatus = (typeof TENANT_ALL_STATUSES)[number];

const SUBSCRIPTION_STATUSES = ['active', 'expired', 'cancelled', 'past_due', 'trial'] as const;
type SubscriptionStatusFilter = (typeof SUBSCRIPTION_STATUSES)[number];

const INVOICE_STATUSES = ['paid', 'pending', 'overdue', 'cancelled'] as const;
type InvoiceStatusFilter = (typeof INVOICE_STATUSES)[number];

export class GetTenantsDto {
  @ApiPropertyOptional({ description: 'رقم الصفحة', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر لكل صفحة', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد العناصر يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'عدد العناصر يجب ألا يتجاوز 100' })
  perPage?: number = 20;

  @ApiPropertyOptional({ description: 'بحث بالاسم أو البريد أو الجوال', example: 'صالون' })
  @IsOptional()
  @IsString({ message: 'نص البحث يجب أن يكون نصاً' })
  search?: string;

  @ApiPropertyOptional({
    description: 'تصفية حسب الحالة',
    enum: TENANT_ALL_STATUSES,
    example: 'active',
  })
  @IsOptional()
  @IsIn([...TENANT_ALL_STATUSES], {
    message: 'الحالة يجب أن تكون: active, suspended, trial, أو cancelled',
  })
  status?: TenantAllStatus;
}

export class UpdateTenantStatusDto {
  @ApiProperty({
    description: 'الحالة الجديدة',
    enum: TENANT_STATUSES,
    example: 'active',
  })
  @IsIn([...TENANT_STATUSES], {
    message: 'الحالة يجب أن تكون active أو suspended',
  })
  status: TenantStatusFilter;
}

export class GetSubscriptionsDto {
  @ApiPropertyOptional({ description: 'رقم الصفحة', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر لكل صفحة', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد العناصر يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'عدد العناصر يجب ألا يتجاوز 100' })
  perPage?: number = 20;

  @ApiPropertyOptional({
    description: 'تصفية حسب حالة الاشتراك',
    enum: SUBSCRIPTION_STATUSES,
    example: 'active',
  })
  @IsOptional()
  @IsIn([...SUBSCRIPTION_STATUSES], {
    message: 'حالة الاشتراك يجب أن تكون: active, expired, cancelled, past_due, أو trial',
  })
  status?: SubscriptionStatusFilter;

  @ApiPropertyOptional({ description: 'تصفية حسب معرف الباقة', example: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف الباقة يجب أن يكون UUID صالح' })
  planId?: string;
}

export class GetInvoicesDto {
  @ApiPropertyOptional({ description: 'رقم الصفحة', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر لكل صفحة', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد العناصر يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'عدد العناصر يجب ألا يتجاوز 100' })
  perPage?: number = 20;

  @ApiPropertyOptional({
    description: 'تصفية حسب حالة الفاتورة',
    enum: INVOICE_STATUSES,
    example: 'paid',
  })
  @IsOptional()
  @IsIn([...INVOICE_STATUSES], {
    message: 'حالة الفاتورة يجب أن تكون: paid, pending, overdue, أو cancelled',
  })
  status?: InvoiceStatusFilter;

  @ApiPropertyOptional({ description: 'بحث برقم الفاتورة أو اسم الصالون', example: 'صالون' })
  @IsOptional()
  @IsString({ message: 'نص البحث يجب أن يكون نصاً' })
  search?: string;
}

// ─── Refresh Token ───
export class AdminRefreshDto {
  @ApiProperty({ description: 'رمز التحديث' })
  @IsString({ message: 'رمز التحديث يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رمز التحديث مطلوب' })
  refreshToken: string;
}

// ─── Settings ───
export class UpdateSettingsDto {
  @ApiProperty({ description: 'الإعدادات كمفتاح-قيمة', example: { platform_name: 'SERVIX' } })
  @IsObject({ message: 'الإعدادات يجب أن تكون كائن' })
  @IsNotEmpty({ message: 'الإعدادات مطلوبة' })
  settings: Record<string, string>;
}

// ─── Backups ───
export class TriggerBackupDto {
  @ApiProperty({ description: 'معرف المنشأة' })
  @IsUUID('4', { message: 'معرف المنشأة يجب أن يكون UUID صالح' })
  tenantId: string;
}

// ─── Notifications ───
export class CreateNotificationDto {
  @ApiProperty({ description: 'عنوان الإشعار' })
  @IsString()
  @IsNotEmpty({ message: 'عنوان الإشعار مطلوب' })
  title: string;

  @ApiProperty({ description: 'نص الإشعار' })
  @IsString()
  @IsNotEmpty({ message: 'نص الإشعار مطلوب' })
  body: string;

  @ApiProperty({ description: 'قناة الإرسال', enum: ['email', 'sms', 'push', 'whatsapp'] })
  @IsIn(['email', 'sms', 'push', 'whatsapp'], { message: 'القناة يجب أن تكون email, sms, push, أو whatsapp' })
  channel: string;

  @ApiProperty({ description: 'الفئة المستهدفة', enum: ['all', 'basic', 'pro', 'enterprise', 'expiring', 'trial'] })
  @IsIn(['all', 'basic', 'pro', 'enterprise', 'expiring', 'trial'], { message: 'الفئة المستهدفة غير صالحة' })
  target: string;

  @ApiPropertyOptional({ description: 'حفظ كمسودة', default: false })
  @IsOptional()
  saveAsDraft?: boolean;
}

export class GetNotificationsDto {
  @ApiPropertyOptional({ description: 'رقم الصفحة', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @ApiPropertyOptional({ description: 'تصفية حسب الحالة', enum: ['draft', 'sent', 'scheduled'] })
  @IsOptional()
  @IsIn(['draft', 'sent', 'scheduled'])
  status?: string;
}

// ─── Coupons ───
export class CreateCouponDto {
  @ApiProperty({ description: 'كود الكوبون', example: 'RAMADAN30' })
  @IsString()
  @IsNotEmpty({ message: 'كود الكوبون مطلوب' })
  code: string;

  @ApiProperty({ description: 'نوع الخصم', enum: ['percentage', 'fixed', 'free'] })
  @IsIn(['percentage', 'fixed', 'free'], { message: 'نوع الخصم غير صالح' })
  type: string;

  @ApiProperty({ description: 'قيمة الخصم', example: 30 })
  @Type(() => Number)
  value: number;

  @ApiPropertyOptional({ description: 'حد الاستخدام (0 = غير محدود)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usageLimit?: number;

  @ApiProperty({ description: 'صالح حتى', example: '2026-12-31' })
  @IsString()
  @IsNotEmpty({ message: 'تاريخ الانتهاء مطلوب' })
  validUntil: string;
}

export class UpdateCouponDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['percentage', 'fixed', 'free'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class GetCouponsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;
}

// ─── Payments (uses existing invoices) ───
export class GetPaymentsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @ApiPropertyOptional({ enum: ['paid', 'pending', 'overdue', 'cancelled'] })
  @IsOptional()
  @IsIn(['paid', 'pending', 'overdue', 'cancelled'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

// ─── Renewals (uses existing subscriptions) ───
export class GetRenewalsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;
}

export class GetAuditLogsDto {
  @ApiPropertyOptional({ description: 'رقم الصفحة', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر لكل صفحة', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد العناصر يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'عدد العناصر يجب ألا يتجاوز 100' })
  perPage?: number = 20;

  @ApiPropertyOptional({ description: 'تصفية حسب معرف المستخدم' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف المستخدم يجب أن يكون UUID صالح' })
  userId?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب نوع الكيان', example: 'tenant' })
  @IsOptional()
  @IsString({ message: 'نوع الكيان يجب أن يكون نصاً' })
  entityType?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب الإجراء', example: 'update_status' })
  @IsOptional()
  @IsString({ message: 'الإجراء يجب أن يكون نصاً' })
  action?: string;
}
