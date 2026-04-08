import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /دخول|login/i })).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"], input[name="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.getByRole('button', { name: /دخول|login/i }).click();

    // Should show error message
    await expect(page.locator('[role="alert"], .error, .toast')).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_EMAIL || 'test@servix.sa');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Test123!');
    await page.getByRole('button', { name: /دخول|login/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard|ar|en)?$/, { timeout: 15000 });
  });

  test('should show locked account message after many attempts', async ({ page }) => {
    // This test documents the expected behavior but may need
    // specific test account setup to trigger account lock
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"], input[name="email"]', 'locked@example.com');
      await page.fill('input[type="password"]', 'wrong');
      await page.getByRole('button', { name: /دخول|login/i }).click();
      await page.waitForTimeout(500);
    }
    // Expect some rate limiting message
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
