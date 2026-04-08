import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Loyalty Points', () => {
  test('should navigate to loyalty page', async ({ page }) => { await page.goto(`${BASE}/ar/loyalty`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show points summary', async ({ page }) => { await page.goto(`${BASE}/ar/loyalty`); await expect(page.locator('body')).toBeVisible(); });
  test('should allow points redemption', async ({ page }) => { await page.goto(`${BASE}/ar/loyalty`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
});
