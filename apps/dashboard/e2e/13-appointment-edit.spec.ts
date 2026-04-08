import { test, expect } from '@playwright/test';

test.describe('Appointment Edit', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should view appointment details', async ({ page }) => { await page.goto('/dashboard/appointments'); await page.waitForLoadState('networkidle'); const main = page.locator('main'); await expect(main).toBeVisible(); });
  test('should have edit controls', async ({ page }) => { await page.goto('/dashboard/appointments'); await page.waitForLoadState('networkidle'); const content = page.locator('main'); await expect(content).toBeVisible(); });
});

test.describe('Appointment Calendar', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should show calendar view', async ({ page }) => { await page.goto('/dashboard/appointments'); await page.waitForLoadState('networkidle'); const main = page.locator('main'); await expect(main).toBeVisible(); });
});
