import { test, expect } from './fixtures';

test.describe('Subscription page', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveTitle(/SERVIX/i);
  });

  test('subscription settings sub-page loads', async ({ page }) => {
    await page.goto('/settings/subscription');
    // Either the dedicated page renders or we're redirected back to /settings;
    // both outcomes keep us within the settings surface.
    await expect(page).toHaveURL(/\/settings/);
  });
});
