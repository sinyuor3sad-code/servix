import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'كلمة المرور الحالية' })
  @IsNotEmpty({ message: 'كلمة المرور الحالية مطلوبة' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  currentPassword: string;

  @ApiProperty({ description: 'كلمة المرور الجديدة', example: 'NewPassword1' })
  @IsNotEmpty({ message: 'كلمة المرور الجديدة مطلوبة' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @MinLength(8, { message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'كلمة المرور يجب أن تحتوي على حرف كبير وحرف صغير ورقم على الأقل',
  })
  newPassword: string;
}
