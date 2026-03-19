import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'الاسم الكامل', example: 'نورة أحمد' })
  @IsNotEmpty({ message: 'الاسم الكامل مطلوب' })
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @MinLength(2, { message: 'الاسم يجب أن يكون حرفين على الأقل' })
  @MaxLength(100, { message: 'الاسم يجب ألا يتجاوز 100 حرف' })
  fullName: string;

  @ApiProperty({ description: 'البريد الإلكتروني', example: 'noura@example.com' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @ApiProperty({ description: 'رقم الجوال السعودي', example: '0512345678' })
  @IsNotEmpty({ message: 'رقم الجوال مطلوب' })
  @IsString({ message: 'رقم الجوال يجب أن يكون نصاً' })
  @Matches(/^(\+?966|0)?5\d{8}$/, {
    message: 'رقم الجوال يجب أن يكون رقم سعودي صالح (مثال: 0512345678)',
  })
  phone: string;

  @ApiProperty({ description: 'كلمة المرور', example: 'MyPassword1' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'كلمة المرور يجب أن تحتوي على حرف كبير وحرف صغير ورقم على الأقل',
  })
  password: string;

  @ApiProperty({ description: 'اسم الصالون بالعربي', example: 'صالون الجمال' })
  @IsNotEmpty({ message: 'اسم الصالون بالعربي مطلوب' })
  @IsString({ message: 'اسم الصالون يجب أن يكون نصاً' })
  @MinLength(2, { message: 'اسم الصالون يجب أن يكون حرفين على الأقل' })
  @MaxLength(100, { message: 'اسم الصالون يجب ألا يتجاوز 100 حرف' })
  salonNameAr: string;

  @ApiPropertyOptional({ description: 'اسم الصالون بالإنجليزي', example: 'Beauty Salon' })
  @IsOptional()
  @IsString({ message: 'اسم الصالون بالإنجليزي يجب أن يكون نصاً' })
  @MinLength(2, { message: 'اسم الصالون يجب أن يكون حرفين على الأقل' })
  @MaxLength(100, { message: 'اسم الصالون يجب ألا يتجاوز 100 حرف' })
  salonNameEn?: string;
}
