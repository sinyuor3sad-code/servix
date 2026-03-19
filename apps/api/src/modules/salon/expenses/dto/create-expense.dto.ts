import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExpenseCategoryEnum {
  RENT = 'rent',
  SALARY = 'salary',
  SUPPLIES = 'supplies',
  UTILITIES = 'utilities',
  MARKETING = 'marketing',
  OTHER = 'other',
}

export class CreateExpenseDto {
  @ApiProperty({
    description: 'تصنيف المصروف',
    enum: ExpenseCategoryEnum,
  })
  @IsEnum(ExpenseCategoryEnum, { message: 'تصنيف المصروف غير صالح' })
  category: ExpenseCategoryEnum;

  @ApiProperty({ description: 'وصف المصروف', maxLength: 200 })
  @IsString({ message: 'وصف المصروف يجب أن يكون نصاً' })
  @MaxLength(200, { message: 'وصف المصروف يجب ألا يتجاوز 200 حرف' })
  description: string;

  @ApiProperty({ description: 'مبلغ المصروف', minimum: 0 })
  @IsNumber({}, { message: 'مبلغ المصروف يجب أن يكون رقماً' })
  @Min(0, { message: 'مبلغ المصروف يجب أن يكون 0 على الأقل' })
  amount: number;

  @ApiProperty({ description: 'تاريخ المصروف' })
  @IsDateString({}, { message: 'تاريخ المصروف يجب أن يكون تاريخاً صالحاً' })
  date: string;

  @ApiPropertyOptional({ description: 'رابط الإيصال', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'رابط الإيصال يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'رابط الإيصال يجب ألا يتجاوز 500 حرف' })
  receiptUrl?: string;
}
