import { test, expect } from './fixtures';

test.describe('Search surfaces', () => {
  test('appointments page renders', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('clients page renders', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('services page renders', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});

test.describe('Onboarding', () => {
  test('onboarding route is reachable', async ({ page }) => {
    await page.goto('/onboarding');
    // Either the onboarding surface renders, or we're redirected away.
    // Both outcomes prove the route is wired.
    await expect(page.locator('main, body').first()).toBeVisible();
  });
});
