import { test, expect } from '@playwright/test';

test.describe('Client Edit & History', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to clients page', async ({ page }) => { await page.goto('/dashboard/clients'); await page.waitForLoadState('networkidle'); const main = page.locator('main'); await expect(main).toBeVisible(); });
  test('should display client list', async ({ page }) => { await page.goto('/dashboard/clients'); await page.waitForLoadState('networkidle'); const content = page.locator('table, [data-testid="clients-list"], .empty-state'); await expect(content.first()).toBeVisible(); });
});

test.describe('Employee Schedule', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to employee page', async ({ page }) => { await page.goto('/dashboard/employees'); await page.waitForLoadState('networkidle'); const main = page.locator('main'); await expect(main).toBeVisible(); });
});
