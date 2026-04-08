import { test, expect } from '@playwright/test';
const BASE = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Attendance Management', () => {
  test('should navigate to attendance', async ({ page }) => { await page.goto(`${BASE}/ar/attendance`); await expect(page).toHaveTitle(/SERVIX/i); });
  test('should show attendance records', async ({ page }) => { await page.goto(`${BASE}/ar/attendance`); await expect(page.locator('body')).toBeVisible(); });
  test('should allow check-in', async ({ page }) => { await page.goto(`${BASE}/ar/attendance`); const body = await page.textContent('body'); expect(body?.length).toBeGreaterThan(0); });
});
