import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsDateString,
  MaxLength,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'اسم العميل', maxLength: 100 })
  @IsString({ message: 'اسم العميل يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'اسم العميل يجب ألا يتجاوز 100 حرف' })
  clientName: string;

  @ApiProperty({ description: 'رقم جوال العميل', maxLength: 15 })
  @IsString({ message: 'رقم الجوال يجب أن يكون نصاً' })
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'رقم الجوال غير صالح' })
  clientPhone: string;

  @ApiProperty({ description: 'معرفات الخدمات المطلوبة', type: [String] })
  @IsArray({ message: 'الخدمات يجب أن تكون قائمة' })
  @ArrayMinSize(1, { message: 'يجب اختيار خدمة واحدة على الأقل' })
  @IsUUID('4', { each: true, message: 'معرف الخدمة يجب أن يكون UUID صالح' })
  serviceIds: string[];

  @ApiPropertyOptional({ description: 'معرف الموظف المفضل' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف الموظف يجب أن يكون UUID صالح' })
  employeeId?: string;

  @ApiProperty({ description: 'تاريخ الموعد' })
  @IsDateString({}, { message: 'التاريخ يجب أن يكون تاريخاً صالحاً' })
  date: string;

  @ApiProperty({ description: 'وقت البدء (HH:mm)', example: '14:30' })
  @IsString({ message: 'وقت البدء يجب أن يكون نصاً' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'وقت البدء يجب أن يكون بصيغة HH:mm',
  })
  startTime: string;

  @ApiPropertyOptional({ description: 'ملاحظات إضافية' })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  @MaxLength(500, { message: 'الملاحظات يجب ألا تتجاوز 500 حرف' })
  notes?: string;
}
