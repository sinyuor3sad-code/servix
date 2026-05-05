import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PosCheckoutPaymentMethod {
  cash = 'cash',
  card = 'card',
  bank_transfer = 'bank_transfer',
  wallet = 'wallet',
  stc_pay = 'stc_pay',
  apple_pay = 'apple_pay',
}

export enum PosCheckoutDiscountType {
  percentage = 'percentage',
  fixed = 'fixed',
}

export enum PosCheckoutSourceType {
  appointment = 'appointment',
  self_order = 'self_order',
}

export enum PosCheckoutLoyaltyType {
  points = 'points',
  visits = 'visits',
}

export class PosCheckoutWalkInDto {
  @ApiProperty({ example: 'Walk-in Customer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '0500000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  phone: string;
}

export class PosCheckoutSourceDto {
  @ApiProperty({ enum: PosCheckoutSourceType })
  @IsEnum(PosCheckoutSourceType)
  type: PosCheckoutSourceType;

  @ApiProperty({ example: 'uuid' })
  @IsUUID('4')
  id: string;
}

export class PosCheckoutItemDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID('4')
  serviceId: string;

  @ApiProperty({ example: 'uuid' })
  @IsUUID('4')
  employeeId: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Customer requested extra care' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class PosCheckoutManualDiscountDto {
  @ApiProperty({ enum: PosCheckoutDiscountType })
  @IsEnum(PosCheckoutDiscountType)
  type: PosCheckoutDiscountType;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ example: 'Manager approved promotion' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason: string;
}

export class PosCheckoutLoyaltyRedemptionDto {
  @ApiProperty({ enum: PosCheckoutLoyaltyType })
  @IsEnum(PosCheckoutLoyaltyType)
  type: PosCheckoutLoyaltyType;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  value: number;
}

export class PosCheckoutPaymentDto {
  @ApiProperty({ enum: PosCheckoutPaymentMethod })
  @IsEnum(PosCheckoutPaymentMethod)
  method: PosCheckoutPaymentMethod;

  @ApiProperty({ example: 115 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  @ApiPropertyOptional({ example: 'AUTH-123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class PosCheckoutDto {
  @ApiProperty({ example: 'client-generated-key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  idempotencyKey: string;

  @ApiProperty({ example: 'terminal-1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  terminalId: string;

  @ApiProperty({ example: 'uuid' })
  @IsUUID('4')
  shiftId: string;

  @ApiPropertyOptional({ example: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiPropertyOptional({ type: PosCheckoutWalkInDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PosCheckoutWalkInDto)
  walkIn?: PosCheckoutWalkInDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;

  @ApiPropertyOptional({ type: PosCheckoutSourceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PosCheckoutSourceDto)
  source?: PosCheckoutSourceDto;

  @ApiProperty({ type: [PosCheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosCheckoutItemDto)
  items: PosCheckoutItemDto[];

  @ApiPropertyOptional({ type: PosCheckoutManualDiscountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PosCheckoutManualDiscountDto)
  manualDiscount?: PosCheckoutManualDiscountDto;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  couponCode?: string;

  @ApiPropertyOptional({ type: PosCheckoutLoyaltyRedemptionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PosCheckoutLoyaltyRedemptionDto)
  loyaltyRedemption?: PosCheckoutLoyaltyRedemptionDto;

  @ApiProperty({ type: [PosCheckoutPaymentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosCheckoutPaymentDto)
  payments: PosCheckoutPaymentDto[];

  @ApiPropertyOptional({ example: 'POS note' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Manager-issued JWT authorising a discount above the cashier role limit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  managerApprovalToken?: string;
}
