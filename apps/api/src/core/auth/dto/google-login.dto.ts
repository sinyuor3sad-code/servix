import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * V-60 — Body shape for `POST /auth/google` (Google OAuth sign-in).
 *
 * Use case: a Google idToken from the frontend Google Sign-In flow is
 * verified by `GoogleAuthService.verifyIdToken` (Google's tokeninfo
 * endpoint — V-13a-verify follow-up will switch to local JWKS). On
 * success, the V-13a flow either signs in a returning user (matched
 * by googleId) or fresh-creates a new GOOGLE-only account. Existing-
 * email-without-googleId triggers the V-13a takeover-block path.
 *
 * Shape is byte-identical to [[LinkGoogleDto]] (link-google.dto.ts,
 * V-13a) — kept separate per V-60 decision #1 for Swagger clarity.
 * GoogleLoginDto is the public sign-in flow; LinkGoogleDto is the
 * JWT-protected "Link Google" settings action.
 */
export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token من Google Sign-In في الفرونت' })
  @IsNotEmpty({ message: 'رمز Google مطلوب' })
  @IsString({ message: 'رمز Google يجب أن يكون نصاً' })
  idToken: string;
}
