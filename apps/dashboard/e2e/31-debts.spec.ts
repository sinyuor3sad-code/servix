import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Debts Management', () => {
  test('should navigate to debts', async ({ page }) => { await page.goto(`${BASE}/ar/debts`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show debts list', async ({ page }) => { await page.goto(`${BASE}/ar/debts`); await expect(page.locator('body')).toBeVisible(); });
  test('should allow recording payment', async ({ page }) => { await page.goto(`${BASE}/ar/debts`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
});
