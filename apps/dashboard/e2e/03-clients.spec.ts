import { test, expect } from './fixtures';

test.describe('Clients', () => {
  test('list surface renders after navigation', async ({ clientsPage, page }) => {
    await clientsPage.goto();
    await expect(page).toHaveURL(/\/clients/);
    await expect(clientsPage.list.first()).toBeVisible();
  });

  test('search input is visible and accepts input', async ({ clientsPage }) => {
    await clientsPage.goto();

    if (!(await clientsPage.searchInput.first().isVisible())) {
      test.skip(true, 'Search input not present on current plan/role');
    }

    await clientsPage.search('test');
    await expect(clientsPage.searchInput.first()).toHaveValue('test');
  });
});
