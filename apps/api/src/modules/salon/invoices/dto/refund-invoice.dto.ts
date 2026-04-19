import {
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefundInvoiceDto {
  @ApiPropertyOptional({ description: 'سبب الإرجاع', example: 'العميلة غير راضية عن الخدمة' })
  @IsOptional()
  @IsString({ message: 'سبب الإرجاع يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'سبب الإرجاع يجب ألا يتجاوز 500 حرف' })
  reason?: string;
}
