import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { login } from './helpers/auth';
import {
  TEST_CREDENTIALS,
  CASHIER_CREDENTIALS,
  AUTH_STATE_PATH,
  CASHIER_AUTH_STATE_PATH,
  BASE_URL,
} from './helpers/constants';

/**
 * Runs once before any test. Logs in with the seeded owner + cashier accounts
 * and persists their storage state so authenticated tests can reuse it via
 * `test.use({ storageState: ... })`.
 *
 * If login fails (no seed data, API down), we log clearly and still write
 * empty storage files — tests that require auth will then fail fast with a
 * readable error instead of timing out on every spec.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? BASE_URL;
  // AUTH_STATE_PATH / CASHIER_AUTH_STATE_PATH are already absolute (resolved
  // against helpers/constants.ts), so no join with rootDir is needed.
  const ownerStatePath = AUTH_STATE_PATH;
  const cashierStatePath = CASHIER_AUTH_STATE_PATH;

  fs.mkdirSync(path.dirname(ownerStatePath), { recursive: true });

  const browser = await chromium.launch();
  try {
    await captureAuth(browser, baseURL, TEST_CREDENTIALS, ownerStatePath, 'owner');
    await captureAuth(browser, baseURL, CASHIER_CREDENTIALS, cashierStatePath, 'cashier');
  } finally {
    await browser.close();
  }
}

async function captureAuth(
  browser: import('@playwright/test').Browser,
  baseURL: string,
  credentials: { email: string; password: string },
  outputPath: string,
  label: string,
): Promise<void> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    await login(page, credentials);
    await context.storageState({ path: outputPath });

    console.log(`[e2e] captured ${label} auth state at ${path.basename(outputPath)}`);
  } catch (err) {
    // Write empty state so tests fail fast (rather than timing out) when
    // the API/seed data isn't available.
    fs.writeFileSync(outputPath, JSON.stringify({ cookies: [], origins: [] }));

    console.error(
      `[e2e] FAILED to log in as ${label} (${credentials.email}). ` +
        `Authenticated tests will fail until the API + seed data are ready.\n` +
        `      Reason: ${(err as Error).message}`,
    );
  } finally {
    await context.close();
  }
}
