import { IsNotEmpty, IsUUID, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const VALID_BILLING_CYCLES = ['monthly', 'yearly'] as const;

type BillingCycleValue = (typeof VALID_BILLING_CYCLES)[number];

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'معرف المنشأة',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'معرف المنشأة مطلوب' })
  @IsUUID('4', { message: 'معرف المنشأة يجب أن يكون UUID صالح' })
  tenantId: string;

  @ApiProperty({
    description: 'معرف الباقة',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty({ message: 'معرف الباقة مطلوب' })
  @IsUUID('4', { message: 'معرف الباقة يجب أن يكون UUID صالح' })
  planId: string;

  @ApiProperty({
    description: 'دورة الفوترة',
    example: 'monthly',
    enum: VALID_BILLING_CYCLES,
  })
  @IsNotEmpty({ message: 'دورة الفوترة مطلوبة' })
  @IsIn([...VALID_BILLING_CYCLES], {
    message: 'دورة الفوترة يجب أن تكون شهرية (monthly) أو سنوية (yearly)',
  })
  billingCycle: BillingCycleValue;
}
