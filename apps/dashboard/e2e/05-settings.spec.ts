import { test, expect } from './fixtures';

test.describe('Settings', () => {
  test('settings page renders a form surface', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('form, input, select').first()).toBeVisible();
  });

  test('salon-name field is editable', async ({ page }) => {
    await page.goto('/settings/salon');
    const nameInput = page
      .locator('input[name*="name" i], input[name*="salon" i]')
      .first();

    if (!(await nameInput.isVisible())) {
      test.skip(true, 'Salon-name input not found on current plan/role');
    }

    const original = await nameInput.inputValue();
    await nameInput.fill('اختبار التعديل');
    await expect(nameInput).toHaveValue('اختبار التعديل');
    // Restore to avoid cross-test pollution.
    await nameInput.fill(original);
  });
});
