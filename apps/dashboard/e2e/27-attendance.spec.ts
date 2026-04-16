import { test, expect } from './fixtures';

test.describe('Attendance', () => {
  test('attendance page loads', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page).toHaveURL(/\/attendance/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
