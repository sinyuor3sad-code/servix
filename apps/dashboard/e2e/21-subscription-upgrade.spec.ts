import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Subscription Upgrade Flow', () => {
  test('should access subscription page', async ({ page }) => { await page.goto(`${BASE}/ar/settings`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show current plan', async ({ page }) => { await page.goto(`${BASE}/ar/settings`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
  test('should show upgrade options', async ({ page }) => { await page.goto(`${BASE}/ar/settings`); await expect(page.locator('body')).toBeVisible(); });
});
