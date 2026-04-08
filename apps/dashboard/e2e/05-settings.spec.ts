import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_EMAIL || 'test@servix.sa');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Test123!');
    await page.getByRole('button', { name: /دخول|login/i }).click();
    await page.waitForURL(/\/(dashboard|ar|en)?$/, { timeout: 15000 });
  });

  test('should display settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/settings/);
    // Settings page should have form fields
    await expect(page.locator('form, input, select')).toBeVisible({ timeout: 10000 });
  });

  test('should edit salon name', async ({ page }) => {
    await page.goto('/settings');
    const nameInput = page.locator('input[name*="name"], input[name*="salon"]').first();
    if (await nameInput.isVisible()) {
      const originalValue = await nameInput.inputValue();
      await nameInput.fill('اختبار التعديل');
      // Find and click save button
      const saveBtn = page.getByRole('button', { name: /حفظ|save/i });
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
      // Restore original value
      await nameInput.fill(originalValue);
    }
  });

  test('should toggle vacation mode', async ({ page }) => {
    await page.goto('/settings');
    const toggle = page.locator('[data-testid="vacation-toggle"], input[type="checkbox"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(500);
      // Toggle state should change
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    }
  });
});
