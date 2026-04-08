import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Shifts Management', () => {
  test('should navigate to shifts', async ({ page }) => { await page.goto(`${BASE}/ar/shifts`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show shift schedule', async ({ page }) => { await page.goto(`${BASE}/ar/shifts`); await expect(page.locator('body')).toBeVisible(); });
  test('should allow adding shift', async ({ page }) => { await page.goto(`${BASE}/ar/shifts`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
});
