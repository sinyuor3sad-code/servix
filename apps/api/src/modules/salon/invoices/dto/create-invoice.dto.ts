import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @ApiPropertyOptional({ description: 'معرّف الخدمة', example: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الخدمة يجب أن يكون UUID صالحاً' })
  serviceId?: string;

  @ApiProperty({ description: 'الوصف', example: 'قص شعر' })
  @IsString({ message: 'الوصف يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'الوصف مطلوب' })
  @MaxLength(200, { message: 'الوصف يجب ألا يتجاوز 200 حرف' })
  description: string;

  @ApiProperty({ description: 'الكمية', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'الكمية يجب أن تكون عدداً صحيحاً' })
  @Min(1, { message: 'الكمية يجب أن تكون 1 على الأقل' })
  quantity: number;

  @ApiProperty({ description: 'سعر الوحدة', example: 150 })
  @Type(() => Number)
  @IsNumber({}, { message: 'سعر الوحدة يجب أن يكون رقماً' })
  @Min(0, { message: 'سعر الوحدة يجب ألا يكون سالباً' })
  unitPrice: number;

  @ApiProperty({ description: 'معرّف الموظف', example: 'uuid' })
  @IsUUID('4', { message: 'معرّف الموظف يجب أن يكون UUID صالحاً' })
  @IsNotEmpty({ message: 'معرّف الموظف مطلوب' })
  employeeId: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'معرّف العميل', example: 'uuid' })
  @IsUUID('4', { message: 'معرّف العميل يجب أن يكون UUID صالحاً' })
  @IsNotEmpty({ message: 'معرّف العميل مطلوب' })
  clientId: string;

  @ApiPropertyOptional({ description: 'معرّف الموعد', example: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الموعد يجب أن يكون UUID صالحاً' })
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'معرّف الطلب الذاتي', example: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الطلب الذاتي يجب أن يكون UUID صالحاً' })
  selfOrderId?: string;

  @ApiProperty({ description: 'عناصر الفاتورة', type: [InvoiceItemDto] })
  @IsArray({ message: 'العناصر يجب أن تكون مصفوفة' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiPropertyOptional({ description: 'ملاحظات', example: 'فاتورة خاصة' })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  notes?: string;
}
