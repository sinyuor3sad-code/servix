import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * V-60 — Body shape for `POST /auth/2fa/verify`.
 *
 * Use case: CONFIRM initial 2FA enrollment from an authenticated
 * session. After the user calls `POST /auth/2fa/setup` (which stores
 * a tentative `user.twoFactorSecret`), they scan the QR in their
 * authenticator app and POST the first 6-digit code here to flip
 * `user.twoFactorEnabled = true`.
 *
 * NOT to be confused with [[Verify2FALoginDto]] (verify-2fa-login.dto.ts)
 * which is the LOGIN-time 2FA challenge (public, post-password).
 * This endpoint is `@ApiBearerAuth()` — JWT-required.
 */
export class Verify2FADto {
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
