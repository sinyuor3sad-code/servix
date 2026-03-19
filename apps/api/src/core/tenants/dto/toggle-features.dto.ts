import { IsArray, IsBoolean, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleFeaturesDto {
  @ApiProperty({
    description: 'قائمة معرفات المميزات',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray({ message: 'معرفات المميزات يجب أن تكون مصفوفة' })
  @ArrayMinSize(1, { message: 'يجب تحديد ميزة واحدة على الأقل' })
  @IsUUID('4', { each: true, message: 'كل معرف ميزة يجب أن يكون UUID صالح' })
  featureIds: string[];

  @ApiProperty({ description: 'تفعيل أو تعطيل المميزات', example: true })
  @IsNotEmpty({ message: 'حالة التفعيل مطلوبة' })
  @IsBoolean({ message: 'حالة التفعيل يجب أن تكون قيمة منطقية (true أو false)' })
  isEnabled: boolean;
}
