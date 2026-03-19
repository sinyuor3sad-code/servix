import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ description: 'معرف التصنيف' })
  @IsUUID('4', { message: 'معرف التصنيف يجب أن يكون UUID صالح' })
  categoryId: string;

  @ApiProperty({ description: 'اسم الخدمة بالعربية', maxLength: 100 })
  @IsString({ message: 'اسم الخدمة يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'اسم الخدمة يجب ألا يتجاوز 100 حرف' })
  nameAr: string;

  @ApiPropertyOptional({
    description: 'اسم الخدمة بالإنجليزية',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'اسم الخدمة بالإنجليزية يجب أن يكون نصاً' })
  @MaxLength(100, {
    message: 'اسم الخدمة بالإنجليزية يجب ألا يتجاوز 100 حرف',
  })
  nameEn?: string;

  @ApiPropertyOptional({ description: 'وصف الخدمة' })
  @IsOptional()
  @IsString({ message: 'وصف الخدمة يجب أن يكون نصاً' })
  descriptionAr?: string;

  @ApiProperty({ description: 'سعر الخدمة', minimum: 0 })
  @IsNumber({}, { message: 'سعر الخدمة يجب أن يكون رقماً' })
  @Min(0, { message: 'سعر الخدمة يجب أن يكون 0 على الأقل' })
  price: number;

  @ApiProperty({ description: 'مدة الخدمة بالدقائق', minimum: 5 })
  @IsInt({ message: 'مدة الخدمة يجب أن تكون عدداً صحيحاً' })
  @Min(5, { message: 'مدة الخدمة يجب أن تكون 5 دقائق على الأقل' })
  duration: number;

  @ApiPropertyOptional({
    description: 'رابط صورة الخدمة',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'رابط الصورة يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'رابط الصورة يجب ألا يتجاوز 500 حرف' })
  imageUrl?: string;
}
