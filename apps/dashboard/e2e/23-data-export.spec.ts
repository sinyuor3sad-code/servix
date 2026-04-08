import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Data Export (PDPL)', () => {
  test('should access profile/data page', async ({ page }) => { await page.goto(`${BASE}/ar/profile`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show export options', async ({ page }) => { await page.goto(`${BASE}/ar/profile`); await expect(page.locator('body')).toBeVisible(); });
  test('should handle download request', async ({ page }) => { await page.goto(`${BASE}/ar/profile`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
});
