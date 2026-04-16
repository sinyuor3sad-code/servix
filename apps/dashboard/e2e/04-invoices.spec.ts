import { test, expect } from './fixtures';

test.describe('Invoices', () => {
  test('list surface renders after navigation', async ({ invoicesPage, page }) => {
    await invoicesPage.goto();
    await expect(page).toHaveURL(/\/invoices/);
    await expect(invoicesPage.list.first()).toBeVisible();
  });

  test('create button is present for users with invoices.create permission', async ({
    invoicesPage,
  }) => {
    await invoicesPage.goto();

    // Owner role (used by default in fixtures) has the permission seeded.
    await expect(invoicesPage.createButton).toBeVisible();
  });
});
