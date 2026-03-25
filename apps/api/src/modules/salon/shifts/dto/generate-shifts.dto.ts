import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Body for POST /shifts/generate-week (optional anchor date). */
export class GenerateShiftsDto {
  @ApiPropertyOptional({
    description: 'Optional start date for the 7-day window (YYYY-MM-DD); defaults to today',
    example: '2025-03-22',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  startDate?: string;
}
