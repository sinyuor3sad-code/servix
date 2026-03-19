import { IsDateString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiProperty({ description: 'تاريخ البداية' })
  @IsDateString({}, { message: 'تاريخ البداية يجب أن يكون تاريخاً صالحاً' })
  dateFrom: string;

  @ApiProperty({ description: 'تاريخ النهاية' })
  @IsDateString({}, { message: 'تاريخ النهاية يجب أن يكون تاريخاً صالحاً' })
  dateTo: string;

  @ApiPropertyOptional({
    description: 'تجميع حسب الفترة',
    enum: ['day', 'week', 'month'],
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'], {
    message: 'التجميع يجب أن يكون يومي أو أسبوعي أو شهري',
  })
  groupBy?: 'day' | 'week' | 'month';
}
