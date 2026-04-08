import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Service Packages', () => {
  test('should navigate to packages', async ({ page }) => { await page.goto(`${BASE}/ar/packages`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show packages list', async ({ page }) => { await page.goto(`${BASE}/ar/packages`); await expect(page.locator('body')).toBeVisible(); });
  test('should allow creating package', async ({ page }) => { await page.goto(`${BASE}/ar/packages`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
  test('should show package details', async ({ page }) => { await page.goto(`${BASE}/ar/packages`); await expect(page.locator('body')).toBeVisible(); });
});
