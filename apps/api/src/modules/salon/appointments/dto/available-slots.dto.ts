import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMinSize,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AvailableSlotsDto {
  @ApiProperty({ description: 'التاريخ', example: '2026-03-20' })
  @IsDateString({}, { message: 'التاريخ يجب أن يكون تاريخاً صالحاً' })
  @IsNotEmpty({ message: 'التاريخ مطلوب' })
  date: string;

  @ApiPropertyOptional({ description: 'معرّف الموظف' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الموظف يجب أن يكون UUID صالحاً' })
  employeeId?: string;

  @ApiProperty({
    description: 'معرّفات الخدمات المطلوبة',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray({ message: 'معرّفات الخدمات يجب أن تكون مصفوفة' })
  @ArrayMinSize(1, { message: 'يجب اختيار خدمة واحدة على الأقل' })
  @IsString({ each: true, message: 'كل معرّف خدمة يجب أن يكون نصاً' })
  serviceIds: string[];
}
