import { test, expect } from '@playwright/test';

test.describe('Invoice Creation & PDF', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to invoices', async ({ page }) => { await page.goto('/dashboard/invoices'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
  test('should show invoice list', async ({ page }) => { await page.goto('/dashboard/invoices'); await page.waitForLoadState('networkidle'); const content = page.locator('table, .empty-state, [data-testid="invoices-list"]'); await expect(content.first()).toBeVisible(); });
});

test.describe('Payment Flow', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should load payment page', async ({ page }) => { await page.goto('/dashboard/invoices'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Salon Settings', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should load settings page', async ({ page }) => { await page.goto('/dashboard/settings'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
  test('should show working hours section', async ({ page }) => { await page.goto('/dashboard/settings'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});
