import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'الاسم الكامل', example: 'نورة أحمد' })
  @IsOptional()
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @MinLength(2, { message: 'الاسم يجب أن يكون حرفين على الأقل' })
  @MaxLength(100, { message: 'الاسم يجب ألا يتجاوز 100 حرف' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'رابط الصورة الشخصية',
    example: 'https://cdn.servix.sa/avatars/photo.jpg',
  })
  @IsOptional()
  @IsString({ message: 'رابط الصورة يجب أن يكون نصاً' })
  avatarUrl?: string;
}
