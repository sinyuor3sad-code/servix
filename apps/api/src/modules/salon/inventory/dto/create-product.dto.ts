import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Product category id' })
  @IsUUID('4', { message: 'categoryId must be a UUID' })
  categoryId: string;

  @ApiProperty({ description: 'Name (Arabic)', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  nameAr: string;

  @ApiPropertyOptional({ description: 'Name (English)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'SKU', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({ description: 'Unit label', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiProperty({ description: 'Cost price' })
  @IsNumber()
  @Min(0)
  costPrice: number;

  @ApiPropertyOptional({ description: 'Sell price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellPrice?: number;

  @ApiPropertyOptional({ description: 'Minimum stock threshold' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ description: 'Whether product is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductCategoryDto {
  @ApiProperty({ description: 'Category name (Arabic)', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  nameAr: string;

  @ApiPropertyOptional({ description: 'Category name (English)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
