import { IsOptional, IsBoolean, IsNumber, Min, IsEnum, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type LoyaltyMode = 'points' | 'visits' | 'both';

export class UpdateLoyaltySettingsDto {
  @ApiPropertyOptional({ description: 'تفعيل نظام الولاء', example: true })
  @IsOptional()
  @IsBoolean({ message: 'حالة التفعيل يجب أن تكون صحيحة أو خاطئة' })
  loyaltyEnabled?: boolean;

  @ApiPropertyOptional({ description: 'نمط الولاء', enum: ['points', 'visits', 'both'], example: 'points' })
  @IsOptional()
  @IsEnum(['points', 'visits', 'both'], { message: 'نمط الولاء يجب أن يكون points أو visits أو both' })
  loyaltyMode?: LoyaltyMode;

  @ApiPropertyOptional({ description: 'نقاط لكل ريال', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'نقاط لكل ريال يجب أن تكون رقماً' })
  @Min(0, { message: 'نقاط لكل ريال يجب ألا تكون سالبة' })
  loyaltyPointsPerSar?: number;

  @ApiPropertyOptional({ description: 'قيمة الاسترداد لكل نقطة بالريال', example: 0.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'قيمة الاسترداد يجب أن تكون رقماً' })
  @Min(0, { message: 'قيمة الاسترداد يجب ألا تكون سالبة' })
  loyaltyRedemptionValue?: number;

  @ApiPropertyOptional({ description: 'عدد الزيارات اللازمة لمكافأة واحدة', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد الزيارات يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد الزيارات يجب أن يكون 1 على الأقل' })
  loyaltyVisitsPerReward?: number;

  @ApiPropertyOptional({ description: 'قيمة المكافأة بالريال لكل دورة زيارات', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'قيمة المكافأة يجب أن تكون رقماً' })
  @Min(0, { message: 'قيمة المكافأة يجب ألا تكون سالبة' })
  loyaltyVisitRewardValue?: number;
}
