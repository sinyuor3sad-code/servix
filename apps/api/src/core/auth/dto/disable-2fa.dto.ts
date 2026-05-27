import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * V-60 — Body shape for `DELETE /auth/2fa` (`disable2FA`).
 *
 * Use case: an authenticated user disables their existing 2FA by
 * re-presenting their current password. The service verifies the
 * password against `user.passwordHash` (bcrypt) before clearing
 * `twoFactorSecret` + `twoFactorEnabled`.
 *
 * Lenient validation (`@IsString + @IsNotEmpty` only — no MinLength,
 * no Matches strength regex) is INTENTIONAL: a user with a legacy
 * password that predates the current strength rules would otherwise
 * be unable to disable 2FA. The bcrypt compare in the service is the
 * actual authorization gate; the DTO just confirms a string was sent.
 */
export class Disable2FADto {
  @ApiProperty({ description: 'كلمة المرور الحالية لتأكيد الإلغاء' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  password: string;
}
