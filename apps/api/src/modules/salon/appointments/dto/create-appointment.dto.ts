import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Matches,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AppointmentServiceItemDto {
  @ApiProperty({ description: 'معرّف الخدمة' })
  @IsUUID('4', { message: 'معرّف الخدمة يجب أن يكون UUID صالحاً' })
  @IsNotEmpty({ message: 'معرّف الخدمة مطلوب' })
  serviceId: string;

  @ApiProperty({ description: 'معرّف الموظف المنفذ' })
  @IsUUID('4', { message: 'معرّف الموظف يجب أن يكون UUID صالحاً' })
  @IsNotEmpty({ message: 'معرّف الموظف مطلوب' })
  employeeId: string;
}

export class CreateAppointmentDto {
  @ApiProperty({ description: 'معرّف العميل' })
  @IsUUID('4', { message: 'معرّف العميل يجب أن يكون UUID صالحاً' })
  @IsNotEmpty({ message: 'معرّف العميل مطلوب' })
  clientId: string;

  @ApiPropertyOptional({ description: 'معرّف الموظف الرئيسي' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الموظف يجب أن يكون UUID صالحاً' })
  employeeId?: string;

  @ApiProperty({ description: 'تاريخ الموعد', example: '2026-03-20' })
  @IsDateString({}, { message: 'تاريخ الموعد يجب أن يكون تاريخاً صالحاً' })
  @IsNotEmpty({ message: 'تاريخ الموعد مطلوب' })
  date: string;

  @ApiProperty({ description: 'وقت البداية (HH:mm)', example: '14:30' })
  @IsString({ message: 'وقت البداية يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'وقت البداية مطلوب' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت البداية يجب أن يكون بصيغة HH:mm',
  })
  startTime: string;

  @ApiPropertyOptional({ description: 'ملاحظات' })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Appointment source', enum: ['online', 'phone', 'walk_in', 'dashboard', 'whatsapp'] })
  @IsOptional()
  @IsIn(['online', 'phone', 'walk_in', 'dashboard', 'whatsapp'])
  source?: 'online' | 'phone' | 'walk_in' | 'dashboard' | 'whatsapp';

  @ApiProperty({
    description: 'الخدمات المطلوبة',
    type: [AppointmentServiceItemDto],
  })
  @IsArray({ message: 'الخدمات يجب أن تكون مصفوفة' })
  @ArrayMinSize(1, { message: 'يجب اختيار خدمة واحدة على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => AppointmentServiceItemDto)
  services: AppointmentServiceItemDto[];
}
