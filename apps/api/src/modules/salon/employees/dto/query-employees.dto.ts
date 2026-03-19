import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class QueryEmployeesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'تصفية حسب الدور',
    enum: ['stylist', 'manager', 'receptionist', 'cashier'],
  })
  @IsOptional()
  @IsIn(['stylist', 'manager', 'receptionist', 'cashier'], {
    message:
      'الدور يجب أن يكون أحد الخيارات: stylist, manager, receptionist, cashier',
  })
  role?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب الحالة' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'حالة الموظف يجب أن تكون قيمة منطقية' })
  isActive?: boolean;
}
