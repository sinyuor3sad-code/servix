import { test, expect } from './fixtures';

test.describe('Coupons', () => {
  test('coupons page loads', async ({ page }) => {
    await page.goto('/coupons');
    await expect(page).toHaveURL(/\/coupons/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});

test.describe('POS', () => {
  test('POS page loads', async ({ page }) => {
    await page.goto('/pos');
    await expect(page).toHaveURL(/\/pos/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});

test.describe('Subscription', () => {
  test('dashboard home loads for authenticated user', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
