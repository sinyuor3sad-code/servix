import { IsString, IsOptional, IsInt, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({ description: 'اسم التصنيف بالعربية', maxLength: 100 })
  @IsString({ message: 'اسم التصنيف يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'اسم التصنيف يجب ألا يتجاوز 100 حرف' })
  nameAr: string;

  @ApiPropertyOptional({
    description: 'اسم التصنيف بالإنجليزية',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'اسم التصنيف بالإنجليزية يجب أن يكون نصاً' })
  @MaxLength(100, {
    message: 'اسم التصنيف بالإنجليزية يجب ألا يتجاوز 100 حرف',
  })
  nameEn?: string;

  @ApiPropertyOptional({ description: 'ترتيب العرض', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ترتيب العرض يجب أن يكون عدداً صحيحاً' })
  @Min(0, { message: 'ترتيب العرض يجب أن يكون 0 على الأقل' })
  sortOrder?: number;
}
