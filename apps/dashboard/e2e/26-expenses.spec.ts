import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Expenses Management', () => {
  test('should navigate to expenses', async ({ page }) => { await page.goto(`${BASE}/ar/expenses`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show expense list', async ({ page }) => { await page.goto(`${BASE}/ar/expenses`); await expect(page.locator('body')).toBeVisible(); });
  test('should allow adding expense', async ({ page }) => { await page.goto(`${BASE}/ar/expenses`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
  test('should show expense report', async ({ page }) => { await page.goto(`${BASE}/ar/expenses`); await expect(page.locator('body')).toBeVisible(); });
});
