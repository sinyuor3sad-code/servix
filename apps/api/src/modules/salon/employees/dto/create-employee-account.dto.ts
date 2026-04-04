import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeAccountDto {
  @ApiProperty({ description: 'البريد الإلكتروني لتسجيل الدخول' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @ApiProperty({ description: 'كلمة المرور', minLength: 6, maxLength: 50 })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
  @MaxLength(50, { message: 'كلمة المرور يجب ألا تتجاوز 50 حرفاً' })
  password: string;
}
