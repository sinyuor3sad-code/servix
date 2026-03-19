import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'البريد الإلكتروني أو رقم الجوال',
    example: 'noura@example.com',
  })
  @IsNotEmpty({ message: 'البريد الإلكتروني أو رقم الجوال مطلوب' })
  @IsString({ message: 'يجب أن يكون نصاً' })
  emailOrPhone: string;

  @ApiProperty({ description: 'كلمة المرور', example: 'MyPassword1' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  password: string;
}
