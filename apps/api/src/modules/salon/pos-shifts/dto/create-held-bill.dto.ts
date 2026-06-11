import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HeldBillCartItemDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsUUID('4')
  serviceId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  serviceName!: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  employeeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employeeName?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ enum: ['fixed', 'percentage'] })
  @IsOptional()
  @IsString()
  discountType?: 'fixed' | 'percentage';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bundleId?: string;
}

export class CreateHeldBillDto {
  @ApiProperty({ description: 'معرّف الوردية المفتوحة' })
  @IsUUID('4')
  shiftId!: string;

  @ApiPropertyOptional({ description: 'معرّف جهاز الكاشير' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  terminalId?: string;

  @ApiProperty({ description: 'اسم الفاتورة المعلّقة', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ type: [HeldBillCartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeldBillCartItemDto)
  cart!: HeldBillCartItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  walkInName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  walkInPhone?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  globalDiscount?: string;

  @ApiPropertyOptional({ enum: ['fixed', 'percentage'], default: 'fixed' })
  @IsOptional()
  @IsString()
  globalDiscountType?: 'fixed' | 'percentage';

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  total!: number;
}
