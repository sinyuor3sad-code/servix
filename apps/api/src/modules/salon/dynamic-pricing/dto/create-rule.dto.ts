import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingRuleType } from '../../../../../generated/tenant';

export class CreatePricingRuleDto {
  @ApiPropertyOptional({ description: 'Scope to a single service' })
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @ApiProperty({ enum: PricingRuleType })
  @IsEnum(PricingRuleType)
  ruleType: PricingRuleType;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  nameAr: string;

  @ApiPropertyOptional({ description: 'Price multiplier', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  multiplier?: number;

  @ApiPropertyOptional({ description: 'Fixed SAR adjustment' })
  @IsOptional()
  @IsNumber()
  fixedAdjustment?: number;

  @ApiProperty({ description: 'JSON rule conditions (time windows, demand, etc.)' })
  @IsObject()
  conditions: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class UpdatePricingRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @ApiPropertyOptional({ enum: PricingRuleType })
  @IsOptional()
  @IsEnum(PricingRuleType)
  ruleType?: PricingRuleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  multiplier?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fixedAdjustment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class CalculatePriceQueryDto {
  @ApiProperty({ description: 'Service id' })
  @IsUUID('4')
  serviceId: string;

  @ApiProperty({ description: 'Date YYYY-MM-DD' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Time HH:mm' })
  @IsString()
  time: string;
}
