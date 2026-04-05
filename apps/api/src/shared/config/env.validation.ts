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
});
