import { IsOptional, IsDateString, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export enum AppointmentStatusFilter {
  pending = 'pending',
  confirmed = 'confirmed',
  in_progress = 'in_progress',
  completed = 'completed',
  cancelled = 'cancelled',
  no_show = 'no_show',
}

export class QueryAppointmentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'تاريخ محدد', example: '2026-03-20' })
  @IsOptional()
  @IsDateString({}, { message: 'التاريخ يجب أن يكون تاريخاً صالحاً' })
  date?: string;

  @ApiPropertyOptional({ description: 'من تاريخ', example: '2026-03-01' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البداية يجب أن يكون تاريخاً صالحاً' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ', example: '2026-03-31' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ النهاية يجب أن يكون تاريخاً صالحاً' })
  dateTo?: string;

  @ApiPropertyOptional({ description: 'حالة الموعد', enum: AppointmentStatusFilter })
  @IsOptional()
  @IsEnum(AppointmentStatusFilter, { message: 'حالة الموعد غير صالحة' })
  status?: AppointmentStatusFilter;

  @ApiPropertyOptional({ description: 'معرّف الموظف' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الموظف يجب أن يكون UUID صالحاً' })
  employeeId?: string;

  @ApiPropertyOptional({ description: 'معرّف العميل' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف العميل يجب أن يكون UUID صالحاً' })
  clientId?: string;
}
