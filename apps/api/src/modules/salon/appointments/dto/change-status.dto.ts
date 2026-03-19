import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AppointmentStatusEnum {
  confirmed = 'confirmed',
  in_progress = 'in_progress',
  completed = 'completed',
  cancelled = 'cancelled',
  no_show = 'no_show',
}

export class ChangeStatusDto {
  @ApiProperty({
    description: 'الحالة الجديدة',
    enum: AppointmentStatusEnum,
  })
  @IsEnum(AppointmentStatusEnum, {
    message: 'الحالة يجب أن تكون: مؤكد، قيد التنفيذ، مكتمل، ملغي، أو لم يحضر',
  })
  @IsNotEmpty({ message: 'الحالة مطلوبة' })
  status: AppointmentStatusEnum;

  @ApiPropertyOptional({ description: 'سبب الإلغاء (مطلوب عند الإلغاء)' })
  @ValidateIf((o) => o.status === AppointmentStatusEnum.cancelled)
  @IsString({ message: 'سبب الإلغاء يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'سبب الإلغاء مطلوب عند إلغاء الموعد' })
  @IsOptional()
  cancellationReason?: string;
}
