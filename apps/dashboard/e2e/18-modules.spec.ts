import { test, expect } from '@playwright/test';

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to inventory', async ({ page }) => { await page.goto('/dashboard/inventory'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Loyalty Program', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should access loyalty settings', async ({ page }) => { await page.goto('/dashboard/loyalty'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to expenses', async ({ page }) => { await page.goto('/dashboard/expenses'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Attendance', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to attendance', async ({ page }) => { await page.goto('/dashboard/attendance'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Shifts', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to shifts', async ({ page }) => { await page.goto('/dashboard/shifts'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Marketing', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to marketing', async ({ page }) => { await page.goto('/dashboard/marketing'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Debts', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to debts', async ({ page }) => { await page.goto('/dashboard/debts'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});

test.describe('Packages', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login'); await page.fill('input[name="phone"]', '+966512345678'); await page.fill('input[name="password"]', 'Test123!'); await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard**'); });
  test('should navigate to packages', async ({ page }) => { await page.goto('/dashboard/packages'); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible(); });
});
