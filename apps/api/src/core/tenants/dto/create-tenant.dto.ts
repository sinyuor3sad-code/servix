import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const VALID_THEMES = [
  'velvet',
  'crystal',
  'orchid',
  'noir',
] as const;

type TenantThemeValue = (typeof VALID_THEMES)[number];

export class CreateTenantDto {
  @ApiProperty({ description: 'اسم المنشأة بالعربية', example: 'صالون الأناقة' })
  @IsString({ message: 'اسم المنشأة بالعربية يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم المنشأة بالعربية مطلوب' })
  @MaxLength(100, { message: 'اسم المنشأة بالعربية يجب ألا يتجاوز 100 حرف' })
  nameAr: string;

  @ApiProperty({ description: 'اسم المنشأة بالإنجليزية', example: 'Elegance Salon' })
  @IsString({ message: 'اسم المنشأة بالإنجليزية يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم المنشأة بالإنجليزية مطلوب' })
  @MaxLength(100, { message: 'اسم المنشأة بالإنجليزية يجب ألا يتجاوز 100 حرف' })
  nameEn: string;

  @ApiProperty({ description: 'المعرف الفريد (slug)', example: 'elegance-salon' })
  @IsString({ message: 'المعرف الفريد يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'المعرف الفريد مطلوب' })
  @MaxLength(50, { message: 'المعرف الفريد يجب ألا يتجاوز 50 حرف' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'المعرف الفريد يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط',
  })
  slug: string;

  @ApiPropertyOptional({ description: 'رقم الجوال', example: '+966512345678' })
  @IsOptional()
  @IsString({ message: 'رقم الجوال يجب أن يكون نصاً' })
  @MaxLength(15, { message: 'رقم الجوال يجب ألا يتجاوز 15 رقم' })
  phone?: string;

  @ApiPropertyOptional({ description: 'البريد الإلكتروني', example: 'info@elegance.com' })
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @MaxLength(100, { message: 'البريد الإلكتروني يجب ألا يتجاوز 100 حرف' })
  email?: string;

  @ApiPropertyOptional({ description: 'المدينة', example: 'الرياض' })
  @IsOptional()
  @IsString({ message: 'المدينة يجب أن تكون نصاً' })
  @MaxLength(50, { message: 'اسم المدينة يجب ألا يتجاوز 50 حرف' })
  city?: string;

  @ApiPropertyOptional({ description: 'العنوان التفصيلي', example: 'حي الملقا، شارع الأمير محمد' })
  @IsOptional()
  @IsString({ message: 'العنوان يجب أن يكون نصاً' })
  address?: string;

  @ApiPropertyOptional({ description: 'اللون الرئيسي (HEX)', example: '#8B5CF6' })
  @IsOptional()
  @IsString({ message: 'اللون الرئيسي يجب أن يكون نصاً' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'اللون الرئيسي يجب أن يكون بصيغة HEX صحيحة مثل #8B5CF6',
  })
  primaryColor?: string;

  @ApiPropertyOptional({
    description: 'قالب التصميم',
    example: 'velvet',
    enum: VALID_THEMES,
  })
  @IsOptional()
  @IsIn([...VALID_THEMES], {
    message: 'القالب يجب أن يكون أحد: velvet, crystal, orchid, noir',
  })
  theme?: TenantThemeValue;
}
