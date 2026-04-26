import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ZatcaOnboardDto {
  @ApiProperty({ description: 'OTP من بوابة فاتورة (6 أرقام)', minLength: 4, maxLength: 10 })
  @IsString()
  @MinLength(4)
  @MaxLength(10)
  otp: string;

  @ApiPropertyOptional({ description: 'Organization unit name for CSR', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizationUnitName?: string;

  @ApiPropertyOptional({ description: 'Use ZATCA production instead of sandbox' })
  @IsOptional()
  @IsBoolean()
  isProduction?: boolean;
}
