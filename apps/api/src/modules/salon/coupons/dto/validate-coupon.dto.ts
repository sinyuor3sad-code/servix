import { IsString, IsNotEmpty, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ValidateCouponDto {
  @ApiProperty({ description: 'كود الكوبون', example: 'SAVE20' })
  @IsString({ message: 'كود الكوبون يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'كود الكوبون مطلوب' })
  @MaxLength(20, { message: 'كود الكوبون يجب ألا يتجاوز 20 حرف' })
  code: string;

  @ApiProperty({ description: 'مبلغ الطلب', example: 250 })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ الطلب يجب أن يكون رقماً' })
  @Min(0.01, { message: 'مبلغ الطلب يجب أن يكون أكبر من صفر' })
  orderAmount: number;
}
