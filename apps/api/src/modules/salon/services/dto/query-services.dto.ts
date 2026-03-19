import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class QueryServicesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'تصفية حسب التصنيف' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف التصنيف يجب أن يكون UUID صالح' })
  categoryId?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب الحالة' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'حالة الخدمة يجب أن تكون قيمة منطقية' })
  isActive?: boolean;
}
