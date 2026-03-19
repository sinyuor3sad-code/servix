import { IsDateString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalendarQueryDto {
  @ApiProperty({ description: 'تاريخ البداية', example: '2026-03-01' })
  @IsDateString({}, { message: 'تاريخ البداية يجب أن يكون تاريخاً صالحاً' })
  @IsNotEmpty({ message: 'تاريخ البداية مطلوب' })
  startDate: string;

  @ApiProperty({ description: 'تاريخ النهاية', example: '2026-03-31' })
  @IsDateString({}, { message: 'تاريخ النهاية يجب أن يكون تاريخاً صالحاً' })
  @IsNotEmpty({ message: 'تاريخ النهاية مطلوب' })
  endDate: string;

  @ApiPropertyOptional({
    description: 'نوع العرض',
    enum: ['week', 'month'],
    default: 'week',
  })
  @IsOptional()
  @IsIn(['week', 'month'], { message: 'نوع العرض يجب أن يكون أسبوعي أو شهري' })
  view?: 'week' | 'month';
}
