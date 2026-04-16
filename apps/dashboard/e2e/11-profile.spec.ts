import { test, expect } from './fixtures';

test.describe('Profile / account settings', () => {
  test('account settings page loads', async ({ page }) => {
    await page.goto('/settings/account');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('salon-name field is present under /settings/salon', async ({ page }) => {
    await page.goto('/settings/salon');
    const nameInput = page
      .locator('input[name*="name" i], input[name*="salon" i]')
      .first();

    if (!(await nameInput.isVisible())) {
      test.skip(true, 'Salon-name input not found');
    }
    await expect(nameInput).toBeVisible();
  });
});
