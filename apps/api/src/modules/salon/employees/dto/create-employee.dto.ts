import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'الاسم الكامل', maxLength: 100 })
  @IsString({ message: 'الاسم الكامل يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'الاسم الكامل يجب ألا يتجاوز 100 حرف' })
  fullName: string;

  @ApiPropertyOptional({ description: 'رقم الهاتف', maxLength: 15 })
  @IsOptional()
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصاً' })
  @MaxLength(15, { message: 'رقم الهاتف يجب ألا يتجاوز 15 رقماً' })
  phone?: string;

  @ApiPropertyOptional({ description: 'البريد الإلكتروني' })
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;

  @ApiProperty({
    description: 'الدور الوظيفي',
    enum: ['stylist', 'cashier', 'makeup', 'nails', 'skincare'],
  })
  @IsIn(['stylist', 'cashier', 'makeup', 'nails', 'skincare'], {
    message:
      'الدور الوظيفي يجب أن يكون أحد الخيارات: stylist, cashier, makeup, nails, skincare',
  })
  role: string;

  @ApiProperty({
    description: 'نوع العمولة',
    enum: ['percentage', 'fixed', 'none'],
  })
  @IsIn(['percentage', 'fixed', 'none'], {
    message: 'نوع العمولة يجب أن يكون: percentage, fixed, أو none',
  })
  commissionType: string;

  @ApiPropertyOptional({ description: 'قيمة العمولة', minimum: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'قيمة العمولة يجب أن تكون رقماً' })
  @Min(0, { message: 'قيمة العمولة يجب أن تكون 0 على الأقل' })
  commissionValue?: number;

  @ApiPropertyOptional({ description: 'الراتب الشهري', minimum: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'الراتب يجب أن يكون رقماً' })
  @Min(0, { message: 'الراتب يجب أن يكون 0 على الأقل' })
  salary?: number;
}
