import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InvoiceItemDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ description: 'ملاحظات', example: 'تم التعديل' })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  notes?: string;

  @ApiPropertyOptional({ description: 'عناصر الفاتورة', type: [InvoiceItemDto] })
  @IsOptional()
  @IsArray({ message: 'العناصر يجب أن تكون مصفوفة' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}
