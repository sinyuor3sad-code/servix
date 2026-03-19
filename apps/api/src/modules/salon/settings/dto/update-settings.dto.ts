import {
  IsArray,
  ValidateNested,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SettingItemDto {
  @ApiProperty({ description: 'مفتاح الإعداد' })
  @IsString({ message: 'مفتاح الإعداد يجب أن يكون نصاً' })
  key: string;

  @ApiProperty({ description: 'قيمة الإعداد' })
  @IsString({ message: 'قيمة الإعداد يجب أن تكون نصاً' })
  value: string;
}

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'قائمة الإعدادات',
    type: [SettingItemDto],
  })
  @IsArray({ message: 'الإعدادات يجب أن تكون قائمة' })
  @ArrayMinSize(1, { message: 'يجب تحديد إعداد واحد على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  settings: SettingItemDto[];
}
