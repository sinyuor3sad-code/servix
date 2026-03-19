import { IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export enum AttendanceStatusEnum {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  HALF_DAY = 'half_day',
  VACATION = 'vacation',
}

export class QueryAttendanceDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'تصفية حسب الموظف' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف الموظف يجب أن يكون UUID صالح' })
  employeeId?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب تاريخ محدد' })
  @IsOptional()
  @IsDateString({}, { message: 'التاريخ يجب أن يكون تاريخاً صالحاً' })
  date?: string;

  @ApiPropertyOptional({ description: 'تصفية من تاريخ' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البداية يجب أن يكون تاريخاً صالحاً' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'تصفية إلى تاريخ' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ النهاية يجب أن يكون تاريخاً صالحاً' })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'تصفية حسب الحالة',
    enum: AttendanceStatusEnum,
  })
  @IsOptional()
  @IsEnum(AttendanceStatusEnum, { message: 'حالة الحضور غير صالحة' })
  status?: AttendanceStatusEnum;
}
