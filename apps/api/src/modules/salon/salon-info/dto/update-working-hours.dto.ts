import {
  IsOptional,
  IsString,
  IsInt,
  IsObject,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateWorkingHoursDto {
  @ApiPropertyOptional({ description: 'أيام العمل (JSON)', type: Object })
  @IsOptional()
  @IsObject({ message: 'أيام العمل يجب أن تكون بتنسيق JSON صالح' })
  workingDays?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'وقت الافتتاح (HH:mm)',
    example: '09:00',
  })
  @IsOptional()
  @IsString({ message: 'وقت الافتتاح يجب أن يكون نصاً' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت الافتتاح يجب أن يكون بتنسيق HH:mm',
  })
  openingTime?: string;

  @ApiPropertyOptional({
    description: 'وقت الإغلاق (HH:mm)',
    example: '22:00',
  })
  @IsOptional()
  @IsString({ message: 'وقت الإغلاق يجب أن يكون نصاً' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت الإغلاق يجب أن يكون بتنسيق HH:mm',
  })
  closingTime?: string;

  @ApiPropertyOptional({
    description: 'مدة الفترة بالدقائق',
    minimum: 5,
    maximum: 120,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'مدة الفترة يجب أن تكون عدداً صحيحاً' })
  @Min(5, { message: 'مدة الفترة يجب أن تكون 5 دقائق على الأقل' })
  @Max(120, { message: 'مدة الفترة يجب ألا تتجاوز 120 دقيقة' })
  slotDuration?: number;

  @ApiPropertyOptional({
    description: 'وقت الاستراحة بين المواعيد بالدقائق',
    minimum: 0,
    maximum: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'وقت الاستراحة يجب أن يكون عدداً صحيحاً' })
  @Min(0, { message: 'وقت الاستراحة يجب أن يكون 0 على الأقل' })
  @Max(60, { message: 'وقت الاستراحة يجب ألا يتجاوز 60 دقيقة' })
  bufferTime?: number;
}
