import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateFeatureDto {
  @ApiProperty({
    description: 'رمز الميزة الفريد',
    example: 'online_booking',
  })
  @IsString({ message: 'رمز الميزة يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رمز الميزة مطلوب' })
  @MaxLength(50, { message: 'رمز الميزة يجب ألا يتجاوز 50 حرف' })
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'رمز الميزة يجب أن يبدأ بحرف إنجليزي صغير ويحتوي على أحرف صغيرة وأرقام وشرطات سفلية فقط',
  })
  code: string;

  @ApiProperty({
    description: 'اسم الميزة بالعربية',
    example: 'الحجز الإلكتروني',
  })
  @IsString({ message: 'اسم الميزة بالعربية يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم الميزة بالعربية مطلوب' })
  @MaxLength(100, { message: 'اسم الميزة بالعربية يجب ألا يتجاوز 100 حرف' })
  nameAr: string;

  @ApiPropertyOptional({
    description: 'وصف الميزة بالعربية',
    example: 'تمكين العملاء من حجز المواعيد عبر الإنترنت',
  })
  @IsOptional()
  @IsString({ message: 'وصف الميزة بالعربية يجب أن يكون نصاً' })
  descriptionAr?: string;
}
