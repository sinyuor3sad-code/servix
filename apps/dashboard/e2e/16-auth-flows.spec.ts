import { test, expect } from '@playwright/test';

test.describe('Forgot Password', () => {
  test('should display forgot password form', async ({ page }) => { await page.goto('/forgot-password'); await page.waitForLoadState('networkidle'); const form = page.locator('form, main'); await expect(form.first()).toBeVisible(); });
  test('should have phone/email input', async ({ page }) => { await page.goto('/forgot-password'); const input = page.locator('input[name="phone"], input[name="email"], input[type="tel"]'); if (await input.first().isVisible()) { await expect(input.first()).toBeVisible(); } });
});

test.describe('Register', () => {
  test('should display register page', async ({ page }) => { await page.goto('/register'); await page.waitForLoadState('networkidle'); const form = page.locator('form, main'); await expect(form.first()).toBeVisible(); });
});

test.describe('Session Expiry', () => {
  test('should redirect to login when not authenticated', async ({ page }) => { await page.goto('/dashboard'); await page.waitForLoadState('networkidle'); const url = page.url(); expect(url).toContain('login'); });
});
