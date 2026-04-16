import { test, expect } from './fixtures';

/**
 * Broad smoke check across all optional modules. Each module is addressable
 * via its root route (no `/dashboard/` prefix). A route that redirects to
 * login indicates the auth state wasn't loaded — tests will fail fast in
 * that case.
 */
const MODULES = [
  { name: 'Inventory', path: '/inventory' },
  { name: 'Loyalty', path: '/loyalty' },
  { name: 'Expenses', path: '/expenses' },
  { name: 'Attendance', path: '/attendance' },
  { name: 'Shifts', path: '/shifts' },
  { name: 'Marketing', path: '/marketing' },
  { name: 'Packages', path: '/packages' },
] as const;

for (const mod of MODULES) {
  test(`module: ${mod.name} page loads`, async ({ page }) => {
    await page.goto(mod.path);
    await expect(page, `${mod.name} did not stay on ${mod.path}`).toHaveURL(
      new RegExp(mod.path.replace('/', '\\/')),
    );
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
}
