import {
  IsArray,
  ValidateNested,
  IsInt,
  IsBoolean,
  IsString,
  Min,
  Max,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class ScheduleDayDto {
  @ApiProperty({ description: 'يوم الأسبوع (0=الأحد, 6=السبت)', minimum: 0, maximum: 6 })
  @IsInt({ message: 'يوم الأسبوع يجب أن يكون عدداً صحيحاً' })
  @Min(0, { message: 'يوم الأسبوع يجب أن يكون بين 0 و 6' })
  @Max(6, { message: 'يوم الأسبوع يجب أن يكون بين 0 و 6' })
  dayOfWeek: number;

  @ApiProperty({ description: 'وقت البداية (HH:mm)', example: '09:00' })
  @IsString({ message: 'وقت البداية يجب أن يكون نصاً' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت البداية يجب أن يكون بتنسيق HH:mm',
  })
  startTime: string;

  @ApiProperty({ description: 'وقت النهاية (HH:mm)', example: '17:00' })
  @IsString({ message: 'وقت النهاية يجب أن يكون نصاً' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت النهاية يجب أن يكون بتنسيق HH:mm',
  })
  endTime: string;

  @ApiProperty({ description: 'هل هو يوم إجازة' })
  @IsBoolean({ message: 'حقل الإجازة يجب أن يكون قيمة منطقية' })
  isDayOff: boolean;
}

export class SetScheduleDto {
  @ApiProperty({
    description: 'جدول الأيام (7 أيام)',
    type: [ScheduleDayDto],
  })
  @IsArray({ message: 'الجدول يجب أن يكون مصفوفة' })
  @ArrayMinSize(1, {
    message: 'الجدول يجب أن يحتوي على يوم واحد على الأقل',
  })
  @ArrayMaxSize(7, {
    message: 'الجدول يجب ألا يتجاوز 7 أيام',
  })
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedules: ScheduleDayDto[];
}
