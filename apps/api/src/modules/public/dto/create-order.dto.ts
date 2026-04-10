import { IsArray, ValidateNested, ArrayMinSize, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderServiceItem {
  @ApiProperty({ description: 'معرّف الخدمة', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsUUID()
  serviceId: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'قائمة الخدمات المختارة',
    type: [OrderServiceItem],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'يجب اختيار خدمة واحدة على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => OrderServiceItem)
  services: OrderServiceItem[];
}
