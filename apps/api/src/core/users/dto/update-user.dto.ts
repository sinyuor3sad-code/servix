import {
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'الاسم الكامل', example: 'أحمد محمد' })
  @IsOptional()
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'الاسم يجب ألا يتجاوز 100 حرف' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'البريد الإلكتروني',
    example: 'ahmed@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;

  @ApiPropertyOptional({
    description: 'رقم الجوال',
    example: '+966501234567',
  })
  @IsOptional()
  @IsString({ message: 'رقم الجوال يجب أن يكون نصاً' })
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'رقم الجوال غير صالح',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'رابط الصورة الشخصية',
    example: '/uploads/images/avatar.webp',
  })
  @IsOptional()
  @IsString({ message: 'رابط الصورة يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'رابط الصورة يجب ألا يتجاوز 500 حرف' })
  avatarUrl?: string;
}
