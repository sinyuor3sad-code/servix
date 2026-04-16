import type { Page } from '@playwright/test';
import { LOGIN_SELECTORS } from './selectors';
import { TIMEOUTS } from './constants';

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Fills the login form and submits it, waiting until the app has left /login.
 *
 * The dashboard routes by role, so we don't assert on a specific post-login
 * path — we only assert that we're no longer on the login screen.
 */
export async function login(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/login');
  await page.waitForSelector(LOGIN_SELECTORS.emailInput, { timeout: TIMEOUTS.ui });

  await page.fill(LOGIN_SELECTORS.emailInput, credentials.email);
  await page.fill(LOGIN_SELECTORS.passwordInput, credentials.password);
  await page.click(LOGIN_SELECTORS.submitButton);

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: TIMEOUTS.navigation,
  });
}

/**
 * Signals to downstream tests that the current page has no authenticated
 * context yet — useful for tests that must run pre-login.
 */
export async function ensureLoggedOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.context().clearPermissions();
}
