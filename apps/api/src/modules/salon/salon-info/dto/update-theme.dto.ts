import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const VALID_COLORS = [
  'purple', 'gold', 'pink', 'black', 'blue', 'green', 'brown', 'fuchsia',
] as const;

const VALID_LAYOUTS = [
  // New 5 layouts
  'luxe', 'bloom', 'glamour', 'golden', 'banan',
  // Legacy (backwards compatibility)
  'classic', 'cards', 'compact', 'elegant',
] as const;

export class UpdateThemeDto {
  @ApiPropertyOptional({
    description: 'رابط الشعار',
    maxLength: 500,
    example: 'https://api.servi-x.com/uploads/logos/logo-123.png',
  })
  @IsOptional()
  @IsString({ message: 'رابط الشعار يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'رابط الشعار يجب ألا يتجاوز 500 حرف' })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'رابط صورة الغلاف',
    maxLength: 500,
    example: 'https://api.servi-x.com/uploads/covers/cover-123.jpg',
  })
  @IsOptional()
  @IsString({ message: 'رابط صورة الغلاف يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'رابط صورة الغلاف يجب ألا يتجاوز 500 حرف' })
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: 'لون العلامة التجارية',
    enum: VALID_COLORS,
    example: 'purple',
  })
  @IsOptional()
  @IsIn([...VALID_COLORS], {
    message: `اللون يجب أن يكون أحد الخيارات: ${VALID_COLORS.join(', ')}`,
  })
  brandColorPreset?: string;

  @ApiPropertyOptional({
    description: 'تخطيط القالب',
    enum: VALID_LAYOUTS,
    example: 'classic',
  })
  @IsOptional()
  @IsIn([...VALID_LAYOUTS], {
    message: `التخطيط يجب أن يكون أحد الخيارات: ${VALID_LAYOUTS.join(', ')}`,
  })
  themeLayout?: string;

  @ApiPropertyOptional({
    description: 'رسالة الترحيب',
    maxLength: 300,
    example: 'أهلاً وسهلاً بكِ في صالوننا',
  })
  @IsOptional()
  @IsString({ message: 'رسالة الترحيب يجب أن تكون نصاً' })
  @MaxLength(300, { message: 'رسالة الترحيب يجب ألا تتجاوز 300 حرف' })
  welcomeMessage?: string;

  @ApiPropertyOptional({
    description: 'رابط خرائط جوجل',
    maxLength: 500,
    example: 'https://maps.google.com/...',
  })
  @IsOptional()
  @IsString({ message: 'رابط خرائط جوجل يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'الرابط يجب ألا يتجاوز 500 حرف' })
  googleMapsUrl?: string;

  @ApiPropertyOptional({
    description: 'معرّف المكان في جوجل',
    maxLength: 100,
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  })
  @IsOptional()
  @IsString({ message: 'معرّف المكان يجب أن يكون نصاً' })
  @MaxLength(100, { message: 'المعرّف يجب ألا يتجاوز 100 حرف' })
  googlePlaceId?: string;
}
