import * as Joi from 'joi';

// V-29/V-30: reject any placeholder marker that .env.example uses, so a freshly
// copied template fails Joi at boot rather than silently shipping with weak secrets.
const PLACEHOLDER_PATTERN = /<REQUIRED|change[-_ ]?me/i;
const placeholderMessage =
  'must not contain a placeholder marker (<REQUIRED…, change-me, CHANGE_ME). Generate with `openssl rand -base64 48`.';

export const AppConfigValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),

  PLATFORM_DATABASE_URL: Joi.string().required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_ACCESS_SECRET: Joi.string()
    .min(64)
    .pattern(PLACEHOLDER_PATTERN, { invert: true, name: 'no-placeholder' })
    .required()
    .messages({ 'string.pattern.name': `JWT_ACCESS_SECRET ${placeholderMessage}` }),
  JWT_REFRESH_SECRET: Joi.string()
    .min(64)
    .pattern(PLACEHOLDER_PATTERN, { invert: true, name: 'no-placeholder' })
    .required()
    .messages({ 'string.pattern.name': `JWT_REFRESH_SECRET ${placeholderMessage}` }),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),

  // Sentry — optional; error tracking disabled when empty
  SENTRY_DSN: Joi.string().uri().allow('').default(''),

  // Google OAuth — optional; disabled when empty
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),

  // Encryption — required in production for PDPL compliance (encrypts PII at rest).
  // V-30: 64 chars matches a 32-byte hex key (AES-256) and rejects placeholders.
  ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .min(64)
      .pattern(PLACEHOLDER_PATTERN, { invert: true, name: 'no-placeholder' })
      .required()
      .messages({ 'string.pattern.name': `ENCRYPTION_KEY ${placeholderMessage}` }),
    otherwise: Joi.string().allow('').default(''),
  }),

  // WhatsApp Webhook — verify token for Meta webhook registration
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').default(''),
  }),

  // WhatsApp phone registration PIN
  WHATSAPP_REGISTRATION_PIN: Joi.string().allow('').default(''),

  // Gemini AI — optional; AI features disabled when empty
  GEMINI_API_KEY: Joi.string().allow('').default(''),

  // Meta WhatsApp Embedded Signup — optional; needed for one-click WhatsApp connect
  META_APP_ID: Joi.string().allow('').default(''),
  META_APP_SECRET: Joi.string().allow('').default(''),
});
