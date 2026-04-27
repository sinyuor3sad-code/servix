import { IsOptional, IsEnum, IsUUID, IsDateString, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export enum InvoiceStatusEnum {
  draft = 'draft',
  paid = 'paid',
  partially_paid = 'partially_paid',
  void = 'void',
  refunded = 'refunded',
}

export class QueryInvoicesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'تصفية بحالة الفاتورة', enum: InvoiceStatusEnum })
  @IsOptional()
  @IsEnum(InvoiceStatusEnum, { message: 'حالة الفاتورة غير صالحة' })
  status?: InvoiceStatusEnum;

  @ApiPropertyOptional({ description: 'تصفية بمعرّف العميل' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف العميل يجب أن يكون UUID صالحاً' })
  clientId?: string;

  @ApiPropertyOptional({ description: 'من تاريخ', example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'التاريخ من يجب أن يكون تاريخاً صالحاً' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ', example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'التاريخ إلى يجب أن يكون تاريخاً صالحاً' })
  dateTo?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب معرّف جهاز POS (NFC)' })
  @IsOptional()
  @IsString({ message: 'معرّف الجهاز يجب أن يكون نصاً' })
  @MaxLength(50, { message: 'معرّف الجهاز يجب ألا يتجاوز 50 حرفاً' })
  terminalId?: string;
}
