import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CampaignTrigger,
  CampaignStatus,
  NotificationChannel,
} from '../../../../../generated/tenant';

export class CreateCampaignDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  nameAr: string;

  @ApiProperty({ enum: CampaignTrigger })
  @IsEnum(CampaignTrigger)
  trigger: CampaignTrigger;

  @ApiProperty({ description: 'Message body (Arabic)' })
  @IsString()
  messageAr: string;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ description: 'Optional targeting filter JSON' })
  @IsOptional()
  @IsObject()
  targetFilter?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  couponId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresSlotAvailability?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional({ enum: CampaignTrigger })
  @IsOptional()
  @IsEnum(CampaignTrigger)
  trigger?: CampaignTrigger;

  @ApiPropertyOptional({ enum: CampaignStatus })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageAr?: string;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  targetFilter?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  couponId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresSlotAvailability?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
