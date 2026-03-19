import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
