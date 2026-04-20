import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsBoolean, IsEnum, IsUrl } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: '0501234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  to!: string;

  @ApiProperty({ example: 'مرحباً من الصالون' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  message!: string;

  @ApiPropertyOptional({ description: 'رسالة تسويقية (يتحقق من ساعات العمل وإلغاء الاشتراك)' })
  @IsOptional()
  @IsBoolean()
  isMarketing?: boolean;
}

export class SendMediaDto extends SendMessageDto {
  @ApiProperty({ enum: ['image', 'document', 'audio', 'video'] })
  @IsEnum(['image', 'document', 'audio', 'video'])
  mediaType!: 'image' | 'document' | 'audio' | 'video';

  @ApiProperty({ example: 'https://example.com/file.pdf' })
  @IsUrl()
  mediaUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}

export class AddOptOutDto {
  @ApiProperty({ example: '0501234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
