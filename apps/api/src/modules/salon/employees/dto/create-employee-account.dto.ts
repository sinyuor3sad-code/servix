import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeAccountDto {\r\n  @ApiProperty({ description: 'البريد الإلكتروني لتسجيل الدخول' })\r\n  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })\r\n  email: string;\r\n\r\n  @ApiProperty({ description: 'كلمة المرور', minLength: 6, maxLength: 50 })\r\n  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })\r\n  @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })\r\n  @MaxLength(50, { message: 'كلمة المرور يجب ألا تتجاوز 50 حرفاً' })\r\n  password: string;\r\n}\r\n
