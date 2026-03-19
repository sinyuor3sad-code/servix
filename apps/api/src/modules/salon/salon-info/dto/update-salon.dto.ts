import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSalonDto {
  @ApiPropertyOptional({ description: 'اسم الصالون بالعربية', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'اسم الصالون يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'اسم الصالون يجب ألا يتجاوز 100 حرف' })
  nameAr?: string;

  @ApiPropertyOptional({ description: 'اسم الصالون بالإنجليزية', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'اسم الصالون بالإنجليزية يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'اسم الصالون بالإنجليزية يجب ألا يتجاوز 100 حرف' })
  nameEn?: string;

  @ApiPropertyOptional({ description: 'شعار الصالون', maxLength: 200 })
  @IsOptional()
  @IsString({ message: 'الشعار يجب أن يكون نصاً' })
  @MaxLength(200, { message: 'الشعار يجب ألا يتجاوز 200 حرف' })
  taglineAr?: string;

  @ApiPropertyOptional({ description: 'وصف الصالون' })
  @IsOptional()
  @IsString({ message: 'الوصف يجب أن يكون نصاً' })
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'رقم الهاتف', maxLength: 15 })
  @IsOptional()
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصاً' })
  @MaxLength(15, { message: 'رقم الهاتف يجب ألا يتجاوز 15 رقماً' })
  phone?: string;

  @ApiPropertyOptional({ description: 'البريد الإلكتروني' })
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;

  @ApiPropertyOptional({ description: 'العنوان' })
  @IsOptional()
  @IsString({ message: 'العنوان يجب أن يكون نصاً' })
  address?: string;

  @ApiPropertyOptional({ description: 'المدينة', maxLength: 50 })
  @IsOptional()
  @IsString({ message: 'المدينة يجب أن تكون نصاً' })
  @MaxLength(50, { message: 'المدينة يجب ألا تتجاوز 50 حرفاً' })
  city?: string;

  @ApiPropertyOptional({
    description: 'نسبة الضريبة',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'نسبة الضريبة يجب أن تكون رقماً' })
  @Min(0, { message: 'نسبة الضريبة يجب أن تكون 0 على الأقل' })
  @Max(100, { message: 'نسبة الضريبة يجب ألا تتجاوز 100' })
  taxPercentage?: number;

  @ApiPropertyOptional({ description: 'الرقم الضريبي', maxLength: 20 })
  @IsOptional()
  @IsString({ message: 'الرقم الضريبي يجب أن يكون نصاً' })
  @MaxLength(20, { message: 'الرقم الضريبي يجب ألا يتجاوز 20 حرفاً' })
  taxNumber?: string;
}
