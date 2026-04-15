import * as Joi from 'joi';

export const AppConfigValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),

  PLATFORM_DATABASE_URL: Joi.string().required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),

  // Sentry — optional; error tracking disabled when empty
  SENTRY_DSN: Joi.string().uri().allow('').default(''),

  // Google OAuth — optional; disabled when empty
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),

  // Encryption — required in production for PDPL compliance (encrypts PII at rest)
  ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
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
