import {
  IsString,
  IsOptional,
  Matches,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const VALID_THEMES = ['velvet', 'crystal', 'orchid', 'noir'] as const;

export class UpdateBrandingDto {
  @ApiPropertyOptional({ description: 'رابط الشعار', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'رابط الشعار يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'رابط الشعار يجب ألا يتجاوز 500 حرف' })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'اللون الرئيسي (hex)',
    example: '#8B5CF6',
  })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'اللون الرئيسي يجب أن يكون بتنسيق hex صالح (مثال: #8B5CF6)',
  })
  primaryColor?: string;

  @ApiPropertyOptional({
    description: 'اللون الثانوي (hex)',
    example: '#06b6d4',
  })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'اللون الثانوي يجب أن يكون بتنسيق hex صالح (مثال: #06b6d4)',
  })
  secondaryColor?: string;

  @ApiPropertyOptional({
    description: 'القالب',
    enum: VALID_THEMES,
  })
  @IsOptional()
  @IsIn([...VALID_THEMES], {
    message: 'القالب يجب أن يكون أحد الخيارات: velvet, crystal, orchid, noir',
  })
  theme?: string;
}
