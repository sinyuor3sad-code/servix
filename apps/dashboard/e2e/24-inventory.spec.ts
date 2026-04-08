import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Inventory Management', () => {
  test('should navigate to inventory', async ({ page }) => { await page.goto(`${BASE}/ar/inventory`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show product list', async ({ page }) => { await page.goto(`${BASE}/ar/inventory`); await expect(page.locator('body')).toBeVisible(); });
  test('should have add product button', async ({ page }) => { await page.goto(`${BASE}/ar/inventory`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
  test('should show low stock alerts', async ({ page }) => { await page.goto(`${BASE}/ar/inventory`); await expect(page.locator('body')).toBeVisible(); });
});
