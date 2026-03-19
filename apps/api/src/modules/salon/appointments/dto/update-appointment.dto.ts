import { IsOptional, IsString, IsUUID, IsDateString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ description: 'تاريخ الموعد', example: '2026-03-20' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ الموعد يجب أن يكون تاريخاً صالحاً' })
  date?: string;

  @ApiPropertyOptional({ description: 'وقت البداية (HH:mm)', example: '14:30' })
  @IsOptional()
  @IsString({ message: 'وقت البداية يجب أن يكون نصاً' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت البداية يجب أن يكون بصيغة HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({ description: 'ملاحظات' })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  notes?: string;

  @ApiPropertyOptional({ description: 'معرّف الموظف' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الموظف يجب أن يكون UUID صالحاً' })
  employeeId?: string;
}
