import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class QueryEmployeesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'تصفية حسب الدور',
    enum: ['stylist', 'cashier', 'makeup', 'nails', 'skincare'],
  })
  @IsOptional()
  @IsIn(['stylist', 'cashier', 'makeup', 'nails', 'skincare'], {
    message:
      'الدور يجب أن يكون أحد الخيارات: stylist, cashier, makeup, nails, skincare',
  })
  role?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب الحالة' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'حالة الموظف يجب أن تكون قيمة منطقية' })
  isActive?: boolean;
}
