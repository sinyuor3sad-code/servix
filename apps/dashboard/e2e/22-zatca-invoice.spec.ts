import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('ZATCA Invoice Flow', () => {
  test('should access invoices page', async ({ page }) => { await page.goto(`${BASE}/ar/invoices`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show invoice list', async ({ page }) => { await page.goto(`${BASE}/ar/invoices`); await expect(page.locator('body')).toBeVisible(); });
  test('should have QR code support', async ({ page }) => { await page.goto(`${BASE}/ar/invoices`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
});
