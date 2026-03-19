import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CheckFeatureDto {
  @ApiProperty({
    description: 'معرف المنشأة',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'معرف المنشأة مطلوب' })
  @IsUUID('4', { message: 'معرف المنشأة يجب أن يكون UUID صالح' })
  tenantId: string;

  @ApiProperty({
    description: 'رمز الميزة',
    example: 'online_booking',
  })
  @IsString({ message: 'رمز الميزة يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رمز الميزة مطلوب' })
  featureCode: string;
}
