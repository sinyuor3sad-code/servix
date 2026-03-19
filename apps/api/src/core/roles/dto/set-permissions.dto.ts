import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class SetPermissionsDto {
  @ApiProperty({
    description: 'قائمة معرفات الصلاحيات',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray({ message: 'معرفات الصلاحيات يجب أن تكون مصفوفة' })
  @ArrayMinSize(1, { message: 'يجب تحديد صلاحية واحدة على الأقل' })
  @IsUUID('4', { each: true, message: 'كل معرف صلاحية يجب أن يكون UUID صالح' })
  permissionIds: string[];
}
