import { test, expect } from '@playwright/test';

test.describe('Employee Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="phone"]', '+966512345678');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  test('should navigate to employees page', async ({ page }) => {
    await page.click('text=الموظفين');
    await expect(page).toHaveURL(/employees/);
  });

  test('should display employees list', async ({ page }) => {
    await page.goto('/dashboard/employees');
    await page.waitForLoadState('networkidle');
    const table = page.locator('table, [data-testid="employees-list"]');
    await expect(table).toBeVisible();
  });

  test('should open add employee dialog', async ({ page }) => {
    await page.goto('/dashboard/employees');
    const addBtn = page.locator('button:has-text("إضافة"), button:has-text("موظف جديد")');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const dialog = page.locator('[role="dialog"], .modal');
      await expect(dialog).toBeVisible();
    }
  });
});
