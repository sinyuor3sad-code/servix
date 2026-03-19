import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'رمز التحديث' })
  @IsNotEmpty({ message: 'رمز التحديث مطلوب' })
  @IsString({ message: 'رمز التحديث يجب أن يكون نصاً' })
  refreshToken: string;
}
