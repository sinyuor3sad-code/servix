import { test, expect } from './fixtures';

test.describe('Data export (PDPL)', () => {
  test('account settings page is reachable', async ({ page }) => {
    await page.goto('/settings/account');
    await expect(page).toHaveURL(/\/settings/);
  });
});
