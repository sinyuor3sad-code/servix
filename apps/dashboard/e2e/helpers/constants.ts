/**
 * Shared test constants.
 *
 * Credentials fall back to the dev-seeded owner account. Override in CI via
 * TEST_EMAIL / TEST_PASSWORD environment variables (or a .env.test file).
 */
import * as path from 'node:path';

export const TEST_CREDENTIALS = {
  email: process.env.TEST_EMAIL ?? 'servix@dev.local',
  password: process.env.TEST_PASSWORD ?? 'adsf1324',
} as const;

export const CASHIER_CREDENTIALS = {
  email: process.env.TEST_CASHIER_EMAIL ?? 'cashier@dev.local',
  password: process.env.TEST_CASHIER_PASSWORD ?? 'adsf1324',
} as const;

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// Resolve storage-state paths from this file's location so both global-setup
// and playwright.config agree regardless of Playwright's rootDir semantics.
// __dirname here = apps/dashboard/e2e/helpers → go up one to apps/dashboard/e2e.
const E2E_DIR = path.resolve(__dirname, '..');
export const AUTH_STATE_PATH = path.resolve(E2E_DIR, '.auth/user.json');
export const CASHIER_AUTH_STATE_PATH = path.resolve(E2E_DIR, '.auth/cashier.json');

/** Sensible defaults for Playwright waits (ms). */
export const TIMEOUTS = {
  /** For navigations after an action (login, form submit). */
  navigation: 15_000,
  /** For network-driven UI changes (toast, row appearing). */
  network: 10_000,
  /** For quick DOM updates. */
  ui: 5_000,
} as const;
