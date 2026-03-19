export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const;

export const JWT = {
  ACCESS_EXPIRATION: '15m',
  REFRESH_EXPIRATION: '7d',
  BCRYPT_ROUNDS: 12,
} as const;

export const PLANS = {
  BASIC: { code: 'basic', price: 199, maxEmployees: 3, maxClients: 100 },
  PRO: { code: 'pro', price: 399, maxEmployees: 10, maxClients: Infinity },
  PREMIUM: { code: 'premium', price: 699, maxEmployees: Infinity, maxClients: Infinity },
} as const;

export const SAR = {
  CODE: 'SAR',
  SYMBOL: 'ر.س',
  DECIMAL_PLACES: 2,
} as const;
