import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * V-60 — Body shape for `POST /auth/2fa/verify-login`.
 *
 * Use case: the SECOND step of a 2FA-enabled login. The user has already
 * submitted email+password via `POST /auth/login` and received a
 * "requires2FA" response; they now resubmit the same email+password plus
 * their current TOTP code from the authenticator app.
 *
 * NOT to be confused with [[Verify2FADto]] (verify-2fa.dto.ts) which is
 * for confirming initial 2FA enrollment from an authenticated session.
 *
 * Field order matches the pre-V-60 inline shape (identity → secret →
 * 2nd factor) so Swagger consumers see the same ordering.
 */
export class Verify2FALoginDto {
  @ApiProperty({
    description: 'البريد الإلكتروني أو رقم الجوال',
    example: 'noura@example.com',
  })
  @IsNotEmpty({ message: 'البريد الإلكتروني أو رقم الجوال مطلوب' })
  @IsString({ message: 'يجب أن يكون نصاً' })
  emailOrPhone: string;

  @ApiProperty({ description: 'كلمة المرور' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  password: string;

  @ApiProperty({
    description: 'رمز التحقق الثنائي من تطبيق Authenticator (6 أرقام)',
    example: '123456',
  })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @IsString({ message: 'رمز التحقق يجب أن يكون نصاً' })
  @Length(6, 6, { message: 'رمز التحقق يجب أن يكون 6 أرقام بالضبط' })
  @Matches(/^\d{6}$/, { message: 'رمز التحقق يجب أن يحتوي على أرقام فقط' })
  code: string;
}
