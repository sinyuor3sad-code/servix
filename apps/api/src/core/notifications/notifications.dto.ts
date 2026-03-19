import { IsBoolean, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const NOTIFICATION_TYPES = [
  'booking_new',
  'booking_confirmed',
  'booking_cancelled',
  'payment',
  'reminder',
  'general',
] as const;

export class GetNotificationsDto {
  @ApiPropertyOptional({
    enum: NOTIFICATION_TYPES,
    description: 'تصفية حسب نوع الإشعار',
  })
  @IsOptional()
  @IsEnum(NOTIFICATION_TYPES, { message: 'نوع الإشعار غير صالح' })
  type?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب حالة القراءة' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'قيمة حالة القراءة يجب أن تكون منطقية' })
  isRead?: boolean;

  @ApiPropertyOptional({ default: 1, description: 'رقم الصفحة' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt({ message: 'رقم الصفحة يجب أن يكون عدد صحيح' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'عدد العناصر في الصفحة' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt({ message: 'عدد العناصر يجب أن يكون عدد صحيح' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  perPage?: number = 20;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'تفعيل إشعارات البريد الإلكتروني' })
  @IsOptional()
  @IsBoolean({ message: 'القيمة يجب أن تكون منطقية' })
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'تفعيل إشعارات الرسائل النصية' })
  @IsOptional()
  @IsBoolean({ message: 'القيمة يجب أن تكون منطقية' })
  smsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'تفعيل إشعارات واتساب' })
  @IsOptional()
  @IsBoolean({ message: 'القيمة يجب أن تكون منطقية' })
  whatsappEnabled?: boolean;

  @ApiPropertyOptional({ description: 'إشعارات الحجوزات' })
  @IsOptional()
  @IsBoolean({ message: 'القيمة يجب أن تكون منطقية' })
  bookingNotifications?: boolean;

  @ApiPropertyOptional({ description: 'إشعارات المدفوعات' })
  @IsOptional()
  @IsBoolean({ message: 'القيمة يجب أن تكون منطقية' })
  paymentNotifications?: boolean;

  @ApiPropertyOptional({ description: 'إشعارات التذكيرات' })
  @IsOptional()
  @IsBoolean({ message: 'القيمة يجب أن تكون منطقية' })
  reminderNotifications?: boolean;
}
