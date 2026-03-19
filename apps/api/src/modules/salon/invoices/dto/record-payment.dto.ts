import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum PaymentMethodEnum {
  cash = 'cash',
  card = 'card',
  bank_transfer = 'bank_transfer',
  wallet = 'wallet',
}

export class RecordPaymentDto {
  @ApiProperty({ description: 'المبلغ', example: 150.0 })
  @Type(() => Number)
  @IsNumber({}, { message: 'المبلغ يجب أن يكون رقماً' })
  @Min(0.01, { message: 'المبلغ يجب أن يكون 0.01 على الأقل' })
  amount: number;

  @ApiProperty({ description: 'طريقة الدفع', enum: PaymentMethodEnum })
  @IsEnum(PaymentMethodEnum, {
    message: 'طريقة الدفع يجب أن تكون: نقد، بطاقة، تحويل بنكي، أو محفظة',
  })
  @IsNotEmpty({ message: 'طريقة الدفع مطلوبة' })
  method: PaymentMethodEnum;

  @ApiPropertyOptional({ description: 'رقم المرجع', example: 'TXN-12345' })
  @IsOptional()
  @IsString({ message: 'رقم المرجع يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'رقم المرجع يجب ألا يتجاوز 100 حرف' })
  reference?: string;
}
