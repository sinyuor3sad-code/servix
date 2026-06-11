import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * V-60 — Body shape for `POST /auth/resend-otp`.
 *
 * Use case: re-issue the email-verification OTP if the original
 * expired or the user lost the email. The rate-limit decorator on
 * the controller (`@RateLimit(3, 60)`) bounds abuse.
 *
 * Shape is byte-identical to [[ForgotPasswordDto]] (forgot-password.dto.ts)
 * — kept separate per V-60 decision #1 for Swagger clarity and
 * future-divergence safety (resend-otp may grow optional fields like
 * delivery channel preference).
 */
export class ResendOtpDto {
  @ApiProperty({
    description: 'البريد الإلكتروني المُسجَّل',
    example: 'noura@example.com',
  })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;
}
