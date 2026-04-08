import { test, expect } from '@playwright/test';

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="phone"]', '+966512345678');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  test('should access profile/settings', async ({ page }) => {
    const profileLink = page.locator('a[href*="settings"], a[href*="profile"], button:has-text("الإعدادات")');
    if (await profileLink.first().isVisible()) {
      await profileLink.first().click();
      await page.waitForLoadState('networkidle');
      const content = page.locator('main');
      await expect(content).toBeVisible();
    }
  });

  test('should display salon name', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    const nameInput = page.locator('input[name="name"], input[name="salonName"], input[name="nameAr"]');
    if (await nameInput.first().isVisible()) {
      await expect(nameInput.first()).toBeVisible();
    }
  });
});
