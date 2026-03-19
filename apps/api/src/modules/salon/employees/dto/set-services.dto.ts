import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetServicesDto {
  @ApiProperty({
    description: 'قائمة معرفات الخدمات المخصصة للموظف',
    type: [String],
  })
  @IsArray({ message: 'قائمة الخدمات يجب أن تكون مصفوفة' })
  @ArrayMinSize(1, {
    message: 'يجب تحديد خدمة واحدة على الأقل',
  })
  @IsUUID('4', {
    each: true,
    message: 'كل معرف خدمة يجب أن يكون UUID صالح',
  })
  serviceIds: string[];
}
