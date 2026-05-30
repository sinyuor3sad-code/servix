import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * V-40a — body for `POST /auth/request-unlock`.
 *
 * Public, post-lockout self-service: a user locked out by V-25 requests an
 * emailed unlock link. The response is uniform regardless of whether the
 * email exists or is locked (V-41 enumeration parity), so this DTO only
 * validates shape.
 */
export class RequestAccountUnlockDto {
  @ApiProperty({ description: 'البريد الإلكتروني', example: 'noura@example.com' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;
}
