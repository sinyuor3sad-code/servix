import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloseShiftDto {
  @ApiProperty({ description: 'المبلغ الفعلي في الصندوق', minimum: 0 })
  @IsNumber({}, { message: 'المبلغ الفعلي يجب أن يكون رقماً' })
  @Min(0, { message: 'المبلغ الفعلي يجب أن يكون 0 على الأقل' })
  closingBalance: number;

  @ApiPropertyOptional({ description: 'ملاحظات', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  @MaxLength(500, { message: 'الملاحظات يجب ألا تتجاوز 500 حرف' })
  notes?: string;
}
