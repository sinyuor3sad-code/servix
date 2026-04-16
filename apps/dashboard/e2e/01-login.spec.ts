import { test, expect } from './fixtures';
import { TEST_CREDENTIALS, TIMEOUTS } from './helpers/constants';

test.describe('Login flow', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('displays login form with email and password fields', async ({ loginPage }) => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('shows an error toast on invalid credentials', async ({ loginPage }) => {
    await loginPage.submit({ email: 'wrong@example.com', password: 'wrongpassword' });
    await loginPage.expectErrorToast();
  });

  test('redirects away from /login on successful login', async ({ page, loginPage }) => {
    await loginPage.submit(TEST_CREDENTIALS);

    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: TIMEOUTS.navigation,
    });
    expect(page.url()).not.toContain('/login');
  });

  test('client-side validation blocks empty submission', async ({ loginPage }) => {
    await loginPage.submitButton.click();

    // Form validation renders inline error copy; either the email or password
    // error is enough to prove we didn't hit the network.
    await expect(
      loginPage.page.getByText(/مطلوب|required/i).first(),
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});
