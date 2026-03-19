import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { ExpenseCategoryEnum } from './create-expense.dto';

export class QueryExpensesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'تصفية حسب التصنيف',
    enum: ExpenseCategoryEnum,
  })
  @IsOptional()
  @IsEnum(ExpenseCategoryEnum, { message: 'تصنيف المصروف غير صالح' })
  category?: ExpenseCategoryEnum;

  @ApiPropertyOptional({ description: 'تصفية من تاريخ' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البداية يجب أن يكون تاريخاً صالحاً' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'تصفية إلى تاريخ' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ النهاية يجب أن يكون تاريخاً صالحاً' })
  dateTo?: string;
}
