import {
  IsDateString,
  IsArray,
  IsUUID,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SlotsQueryDto {
  @ApiProperty({ description: 'التاريخ المطلوب' })
  @IsDateString({}, { message: 'التاريخ يجب أن يكون تاريخاً صالحاً' })
  date: string;

  @ApiProperty({ description: 'معرفات الخدمات المطلوبة', type: [String] })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsArray({ message: 'الخدمات يجب أن تكون قائمة' })
  @ArrayMinSize(1, { message: 'يجب اختيار خدمة واحدة على الأقل' })
  @IsUUID('4', { each: true, message: 'معرف الخدمة يجب أن يكون UUID صالح' })
  @Type(() => String)
  serviceIds: string[];

  @ApiPropertyOptional({ description: 'معرف الموظف المفضل' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف الموظف يجب أن يكون UUID صالح' })
  employeeId?: string;
}
