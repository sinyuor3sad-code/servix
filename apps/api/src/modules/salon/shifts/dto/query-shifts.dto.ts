import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryShiftsDto {
  @ApiProperty({ description: 'Shift date (YYYY-MM-DD)', example: '2025-03-22' })
  @IsDateString({}, { message: 'date must be a valid ISO date string' })
  date: string;
}
