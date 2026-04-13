import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsInt,
  IsDateString,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum CouponTypeEnum {
  percentage = 'percentage',
  fixed = 'fixed',
}

export class CreateCouponDto {
  @ApiProperty({ description: 'كود الكوبون', example: 'SAVE20' })
  @IsString({ message: 'كود الكوبون يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'كود الكوبون مطلوب' })
  @MaxLength(20, { message: 'كود الكوبون يجب ألا يتجاوز 20 حرف' })
  code: string;

  @ApiProperty({ description: 'نوع الكوبون', enum: CouponTypeEnum })
  @IsEnum(CouponTypeEnum, { message: 'نوع الكوبون يجب أن يكون نسبة مئوية أو مبلغ ثابت' })
  @IsNotEmpty({ message: 'نوع الكوبون مطلوب' })
  type: CouponTypeEnum;

  @ApiProperty({ description: 'قيمة الكوبون', example: 20 })
  @Type(() => Number)
  @IsNumber({}, { message: 'قيمة الكوبون يجب أن تكون رقماً' })
  @Min(0.01, { message: 'قيمة الكوبون يجب أن تكون أكبر من صفر' })
  value: number;

  @ApiPropertyOptional({ description: 'الحد الأدنى للطلب', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'الحد الأدنى للطلب يجب أن يكون رقماً' })
  @Min(0, { message: 'الحد الأدنى للطلب يجب ألا يكون سالباً' })
  minOrder?: number;

  @ApiPropertyOptional({ description: 'الحد الأقصى للخصم', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'الحد الأقصى للخصم يجب أن يكون رقماً' })
  @Min(0, { message: 'الحد الأقصى للخصم يجب ألا يكون سالباً' })
  maxDiscount?: number;

  @ApiPropertyOptional({ description: 'الحد الأقصى للاستخدام (فارغ = بلا حد)', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'الحد الأقصى للاستخدام يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'الحد الأقصى للاستخدام يجب أن يكون 1 على الأقل' })
  usageLimit?: number;

  @ApiProperty({ description: 'تاريخ البداية', example: '2026-01-01T09:00:00.000Z' })
  @IsDateString({}, { message: 'تاريخ البداية يجب أن يكون تاريخاً صالحاً' })
  @IsNotEmpty({ message: 'تاريخ البداية مطلوب' })
  validFrom: string;

  @ApiPropertyOptional({ description: 'تاريخ الانتهاء (فارغ = مفتوح)', example: '2026-12-31T23:59:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ الانتهاء يجب أن يكون تاريخاً صالحاً' })
  validUntil?: string;

  @ApiPropertyOptional({ description: 'حذف تلقائي بعد 24 ساعة من الانتهاء', example: false })
  @IsOptional()
  @IsBoolean({ message: 'الحذف التلقائي يجب أن يكون صح أو خطأ' })
  autoDelete?: boolean;
}
