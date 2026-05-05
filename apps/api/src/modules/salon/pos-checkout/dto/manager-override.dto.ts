import { IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManagerOverrideRequestDto {
  @ApiProperty({ description: 'كلمة مرور المديرة/المالكة المعتمِدة' })
  @IsString({ message: 'كلمة المرور مطلوبة' })
  @MaxLength(100)
  password!: string;

  @ApiProperty({ description: 'نسبة الخصم المطلوب اعتمادها (%)', minimum: 0 })
  @IsNumber()
  @Min(0)
  discountPercent!: number;

  @ApiProperty({ description: 'سبب الخصم' })
  @IsString({ message: 'السبب مطلوب' })
  @MaxLength(500)
  reason!: string;
}
