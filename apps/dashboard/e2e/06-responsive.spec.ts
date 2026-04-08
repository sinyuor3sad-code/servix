import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_EMAIL || 'test@servix.sa');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Test123!');
    await page.getByRole('button', { name: /دخول|login/i }).click();
    await page.waitForURL(/\/(dashboard|ar|en)?$/, { timeout: 15000 });
  });

  test('login page renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    // No horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('dashboard sidebar collapses on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Sidebar should be hidden or collapsed on mobile
    const sidebar = page.locator('aside, nav, [data-testid="sidebar"]').first();
    if (await sidebar.isVisible()) {
      const box = await sidebar.boundingBox();
      // On mobile, sidebar should be off-screen or narrow
      if (box) {
        expect(box.width).toBeLessThan(300);
      }
    }
  });

  test('main pages render without overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const pages = ['/appointments', '/clients', '/invoices', '/settings'];
    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(1500);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
    }
  });
});
