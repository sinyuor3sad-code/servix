import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdjustVisitsDto {
  @ApiProperty({ description: 'عدد الزيارات (يمكن أن يكون سالباً للخصم)', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'عدد الزيارات يجب أن يكون عدداً صحيحاً' })
  @IsNotEmpty({ message: 'عدد الزيارات مطلوب' })
  visits!: number;

  @ApiProperty({ description: 'وصف التعديل', example: 'زيارة يدوية - مناسبة خاصة' })
  @IsString({ message: 'الوصف يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'وصف التعديل مطلوب' })
  @MaxLength(200, { message: 'الوصف يجب ألا يتجاوز 200 حرف' })
  description!: string;
}

export class RedeemVisitsDto {
  @ApiProperty({ description: 'عدد الزيارات المراد استبدالها', example: 10 })
  @Type(() => Number)
  @IsInt()
  visits!: number;

  @ApiProperty({ description: 'معرّف الفاتورة', example: 'uuid' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;
}
