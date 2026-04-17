import { defineConfig, devices } from '@playwright/test';
import * as path from 'node:path';
import { AUTH_STATE_PATH } from './e2e/helpers/constants';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const IS_CI = !!process.env.CI;

/**
 * Playwright config for the SERVIX dashboard.
 *
 * Auth state is captured once in global-setup.ts and reused across all
 * authenticated projects via `storageState`. Anonymous projects
 * (login, register, forgot-password) run without stored auth.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 2 : undefined,
  reporter: IS_CI
    ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 7_500 },

  globalSetup: path.resolve(__dirname, './e2e/global-setup.ts'),
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: IS_CI ? 'retain-on-failure' : 'off',
    locale: 'ar-SA',
    /** Fail fast on unhandled page errors. */
    bypassCSP: false,
  },

  projects: [
    /* ─────────────── Anonymous (no stored auth) ─────────────── */
    {
      name: 'anonymous-chromium',
      testMatch: [
        '**/01-login.spec.ts',
        '**/16-auth-flows.spec.ts',
        '**/19-visual-regression.spec.ts',
        '**/20-accessibility.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },

    /* ─────────────── Authenticated (owner) desktop ─────────────── */
    {
      name: 'authenticated-chromium',
      testIgnore: [
        '**/01-login.spec.ts',
        '**/16-auth-flows.spec.ts',
        '**/06-responsive.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_PATH,
      },
    },

    /* ─────────────── Authenticated (owner) mobile ─────────────── */
    {
      name: 'authenticated-mobile',
      testMatch: ['**/06-responsive.spec.ts'],
      use: {
        ...devices['iPhone 14'],
        storageState: AUTH_STATE_PATH,
      },
    },
  ],

  /**
   * When CI sets PLAYWRIGHT_WEB_SERVER=1, Playwright will boot the Next dev
   * server and wait on the baseURL. Locally, we assume the developer has it
   * running already.
   */
  webServer: process.env.PLAYWRIGHT_WEB_SERVER
    ? {
        command: 'pnpm --filter @servix/dashboard dev',
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !IS_CI,
      }
    : undefined,
});
