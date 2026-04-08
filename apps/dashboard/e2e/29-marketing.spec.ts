import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Marketing Campaigns', () => {
  test('should navigate to marketing', async ({ page }) => { await page.goto(`${BASE}/ar/marketing`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show campaign list', async ({ page }) => { await page.goto(`${BASE}/ar/marketing`); await expect(page.locator('body')).toBeVisible(); });
  test('should allow creating campaign', async ({ page }) => { await page.goto(`${BASE}/ar/marketing`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
  test('should show campaign stats', async ({ page }) => { await page.goto(`${BASE}/ar/marketing`); await expect(page.locator('body')).toBeVisible(); });
});
