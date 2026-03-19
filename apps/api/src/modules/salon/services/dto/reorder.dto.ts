import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class ReorderItemDto {
  @ApiProperty({ description: 'معرف الخدمة' })
  @IsUUID('4', { message: 'معرف الخدمة يجب أن يكون UUID صالح' })
  id: string;

  @ApiProperty({ description: 'ترتيب العرض', minimum: 0 })
  @IsInt({ message: 'ترتيب العرض يجب أن يكون عدداً صحيحاً' })
  @Min(0, { message: 'ترتيب العرض يجب أن يكون 0 على الأقل' })
  sortOrder: number;
}

export class ReorderServicesDto {
  @ApiProperty({
    description: 'قائمة الخدمات مع ترتيبها',
    type: [ReorderItemDto],
  })
  @IsArray({ message: 'القائمة يجب أن تكون مصفوفة' })
  @ArrayMinSize(1, {
    message: 'القائمة يجب أن تحتوي على عنصر واحد على الأقل',
  })
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
