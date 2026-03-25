import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ZatcaOnboardDto {
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
