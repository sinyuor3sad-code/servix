import { test, expect } from './fixtures';

test.describe('Employee management', () => {
  test('employees page loads', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/employees/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('"add employee" triggers dialog or navigates to /employees/new', async ({ page }) => {
    await page.goto('/employees');

    const addBtn = page.getByRole('button', { name: /إضافة|جديد|add|new/i }).first();
    if (!(await addBtn.isVisible())) {
      test.skip(true, 'Add-employee button not visible for current role');
    }

    await addBtn.click();
    const dialogOpen = page.locator('[role="dialog"], dialog[open]').first().waitFor({
      state: 'visible',
      timeout: 3_000,
    });
    const navigated = page.waitForURL(/\/employees\/new/, { timeout: 3_000 });
    await Promise.race([dialogOpen, navigated]);
  });
});
