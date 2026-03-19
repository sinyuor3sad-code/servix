import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCouponDto {
  @ApiProperty({ description: 'كود الكوبون', example: 'SAVE20' })
  @IsString({ message: 'كود الكوبون يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'كود الكوبون مطلوب' })
  @MaxLength(20, { message: 'كود الكوبون يجب ألا يتجاوز 20 حرف' })
  code: string;
}
