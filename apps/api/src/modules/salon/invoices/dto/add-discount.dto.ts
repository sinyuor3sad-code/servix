import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum DiscountTypeEnum {
  percentage = 'percentage',
  fixed = 'fixed',
}

export class AddDiscountDto {
  @ApiProperty({ description: 'نوع الخصم', enum: DiscountTypeEnum })
  @IsEnum(DiscountTypeEnum, { message: 'نوع الخصم يجب أن يكون نسبة مئوية أو مبلغ ثابت' })
  @IsNotEmpty({ message: 'نوع الخصم مطلوب' })
  type: DiscountTypeEnum;

  @ApiProperty({ description: 'قيمة الخصم', example: 10 })
  @Type(() => Number)
  @IsNumber({}, { message: 'قيمة الخصم يجب أن تكون رقماً' })
  @Min(0.01, { message: 'قيمة الخصم يجب أن تكون أكبر من صفر' })
  value: number;

  @ApiPropertyOptional({ description: 'سبب الخصم', example: 'عميل مميز' })
  @IsOptional()
  @IsString({ message: 'سبب الخصم يجب أن يكون نصاً' })
  @MaxLength(200, { message: 'سبب الخصم يجب ألا يتجاوز 200 حرف' })
  reason?: string;
}
