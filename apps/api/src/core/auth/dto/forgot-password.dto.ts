import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'البريد الإلكتروني', example: 'noura@example.com' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;
}
