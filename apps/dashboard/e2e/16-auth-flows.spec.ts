import { test, expect } from './fixtures';

test.describe('Forgot password', () => {
  test('renders the forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('form').first()).toBeVisible();
  });

  test('has a phone or email identifier input', async ({ page }) => {
    await page.goto('/forgot-password');
    const input = page.locator(
      'input[name="phone"], input[name="email"], input[type="tel"], input[autocomplete="email"]',
    );
    await expect(input.first()).toBeVisible();
  });
});

test.describe('Register', () => {
  test('renders the register form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('form').first()).toBeVisible();
  });
});

test.describe('Session expiry', () => {
  test('redirects unauthenticated visits to /login', async ({ page }) => {
    // This spec runs under the anonymous project — no cookies loaded.
    await page.goto('/');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
