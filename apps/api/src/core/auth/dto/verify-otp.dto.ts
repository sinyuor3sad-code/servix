import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * V-60 — Body shape for `POST /auth/verify-otp`.
 *
 * Use case: email-verification OTP during signup or email-change
 * flows. NOT the 2FA TOTP — for that see [[Verify2FALoginDto]]
 * (post-login challenge) or [[Verify2FADto]] (initial enrollment).
 *
 * The 6-digit format is enforced by V-13b's `auth.service.generateOtpCode`
 * (`crypto.randomInt(100000, 1_000_000)`). Surfacing the constraint at
 * the DTO is a contract formalization, not a behavior change — the
 * service already rejects non-6-digit codes.
 */
export class VerifyOtpDto {
  @ApiProperty({
    description: 'البريد الإلكتروني المُسجَّل',
    example: 'noura@example.com',
  })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @ApiProperty({
    description: 'رمز التحقق المُرسَل للبريد (6 أرقام)',
    example: '123456',
  })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @IsString({ message: 'رمز التحقق يجب أن يكون نصاً' })
  @Length(6, 6, { message: 'رمز التحقق يجب أن يكون 6 أرقام بالضبط' })
  @Matches(/^\d{6}$/, { message: 'رمز التحقق يجب أن يحتوي على أرقام فقط' })
  code: string;
}
