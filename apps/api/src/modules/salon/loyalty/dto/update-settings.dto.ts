import { IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateLoyaltySettingsDto {
  @ApiPropertyOptional({ description: 'تفعيل نظام الولاء', example: true })
  @IsOptional()
  @IsBoolean({ message: 'حالة التفعيل يجب أن تكون صحيحة أو خاطئة' })
  loyaltyEnabled?: boolean;

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
}
