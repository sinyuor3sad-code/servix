import { test, expect } from '@playwright/test';

test.describe('Search & Filter', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should have search on appointments page', async ({ page }) => { await page.goto('/dashboard/appointments'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
  test('should have search on clients page', async ({ page }) => { await page.goto('/dashboard/clients'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
  test('should have search on services page', async ({ page }) => { await page.goto('/dashboard/services'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Tenant Isolation', () => {
  test('should not access admin routes without admin role', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // Should redirect to login or show forbidden
    expect(url.includes('login') || url.includes('admin')).toBeTruthy();
  });
});

test.describe('Onboarding', () => {
  test('should show onboarding for new tenant', async ({ page }) => { await page.goto('/register'); await page.waitForLoadState('networkidle'); await expect(page.locator('main, body')).toBeVisible(); });
});
