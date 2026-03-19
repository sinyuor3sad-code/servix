import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdjustPointsDto {
  @ApiProperty({ description: 'عدد النقاط (يمكن أن يكون سالباً للخصم)', example: 50 })
  @Type(() => Number)
  @IsInt({ message: 'عدد النقاط يجب أن يكون عدداً صحيحاً' })
  @IsNotEmpty({ message: 'عدد النقاط مطلوب' })
  points: number;

  @ApiProperty({ description: 'وصف التعديل', example: 'تعديل يدوي - مكافأة عميل مميز' })
  @IsString({ message: 'الوصف يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'وصف التعديل مطلوب' })
  @MaxLength(200, { message: 'الوصف يجب ألا يتجاوز 200 حرف' })
  description: string;
}
