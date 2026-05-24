/**
 * V-13a / A2-03 — accepted values for `User.authProvider`.
 *
 * Stored as a plain VARCHAR(20) in `platform.users.auth_provider` (no Prisma
 * enum — see Phase A decision 3). Keep this constant as the single source of
 * truth so the runtime never has to inline string literals like 'local' /
 * 'google' / 'both', which (a) drift, and (b) are unfindable by grep when a
 * value changes.
 *
 * Semantics:
 *   LOCAL  — password-only account. Created via /auth/register or the OTP
 *            verification path. No Google link.
 *   GOOGLE — pure Google-first account. Created via /auth/google for an
 *            email that did NOT already exist. No usable password (a random
 *            bcrypt hash is stored to satisfy the NOT NULL constraint).
 *   BOTH   — account has both a password AND a Google link. Reached only via
 *            POST /auth/link-google from an authenticated LOCAL account.
 *            The legacy silent-link-on-google-login path was removed in
 *            V-13a; see auth.service.googleLogin and the
 *            'auth_google_takeover_blocked' audit row for the new contract.
 */
export const AUTH_PROVIDERS = {
  LOCAL: 'local',
  GOOGLE: 'google',
  BOTH: 'both',
} as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];
