import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InventoryMovementTypeEnum {
  purchase = 'purchase',
  consumption = 'consumption',
  adjustment = 'adjustment',
  waste = 'waste',
  return_to_supplier = 'return_to_supplier',
}

export class CreateMovementDto {
  @ApiProperty({ enum: InventoryMovementTypeEnum })
  @IsEnum(InventoryMovementTypeEnum)
  type: InventoryMovementTypeEnum;

  @ApiProperty({ description: 'Quantity delta' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Reference entity type' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference entity id' })
  @IsOptional()
  @IsUUID('4')
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Note', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiProperty({ description: 'User id performing the movement' })
  @IsUUID('4')
  createdBy: string;
}
