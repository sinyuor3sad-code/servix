import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * V-40a — body for `POST /auth/unlock`.
 *
 * Redeems the emailed unlock token (raw value; the server SHA-256-hashes it
 * to look up the single-use row). Distinct DTO from the reset-password token
 * to avoid token-type confusion across the two flows.
 */
export class UnlockAccountDto {
  @ApiProperty({ description: 'رمز فك القفل المُرسَل بالبريد' })
  @IsNotEmpty({ message: 'رمز فك القفل مطلوب' })
  @IsString({ message: 'الرمز يجب أن يكون نصاً' })
  token: string;
}
