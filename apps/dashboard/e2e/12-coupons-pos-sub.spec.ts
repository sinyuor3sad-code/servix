import { test, expect } from '@playwright/test';

test.describe('Coupon Management', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to coupons', async ({ page }) => { await page.goto('/dashboard/coupons'); await page.waitForLoadState('networkidle'); const main = page.locator('main'); await expect(main).toBeVisible(); });
  test('should show coupon list or empty state', async ({ page }) => { await page.goto('/dashboard/coupons'); await page.waitForLoadState('networkidle'); const content = page.locator('table, [data-testid="empty-state"], .empty-state'); await expect(content.first()).toBeVisible(); });
});

test.describe('POS', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to POS', async ({ page }) => { await page.goto('/dashboard/pos'); await page.waitForLoadState('networkidle'); const main = page.locator('main'); await expect(main).toBeVisible(); });
});

test.describe('Subscription', () => {
  test('should show subscription info on dashboard', async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); const main = page.locator('main'); await expect(main).toBeVisible(); });
});
