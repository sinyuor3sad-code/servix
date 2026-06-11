import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  // V-39: optional — browser clients send the token via the servix_rt
  // httpOnly cookie instead; the controller rejects when both are absent.
  @ApiPropertyOptional({ description: 'رمز التحديث (اختياري عند استخدام الكوكي)' })
  @IsOptional()
  @IsNotEmpty({ message: 'رمز التحديث مطلوب' })
  @IsString({ message: 'رمز التحديث يجب أن يكون نصاً' })
  refreshToken?: string;
}
