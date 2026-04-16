import { test, expect } from './fixtures';
import { COMMON_SELECTORS } from './helpers/selectors';

test.describe('Appointments', () => {
  test('calendar surface renders after navigation', async ({ appointmentsPage, page }) => {
    await appointmentsPage.goto();
    await expect(page).toHaveURL(/\/appointments/);
    await expect(appointmentsPage.surface.first()).toBeVisible();
  });

  test('"new appointment" button opens a dialog or navigates to form', async ({
    appointmentsPage,
    page,
  }) => {
    await appointmentsPage.goto();

    if (!(await appointmentsPage.addButton.isVisible())) {
      test.skip(true, 'No "new appointment" button — role may lack appointments.create');
    }

    await appointmentsPage.openNewDialog();

    // Either a modal opens, or we navigate to /appointments/new.
    const dialog = page.locator(COMMON_SELECTORS.dialog);
    const navigatedToNew = page.waitForURL(/\/appointments\/new/, { timeout: 3_000 });

    await Promise.race([dialog.waitFor({ state: 'visible', timeout: 3_000 }), navigatedToNew]);
  });
});
