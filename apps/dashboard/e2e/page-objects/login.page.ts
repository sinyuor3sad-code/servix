import type { Locator, Page } from '@playwright/test';
import { LOGIN_SELECTORS } from '../helpers/selectors';
import { TIMEOUTS } from '../helpers/constants';
import type { Credentials } from '../helpers/auth';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator(LOGIN_SELECTORS.emailInput);
    this.passwordInput = page.locator(LOGIN_SELECTORS.passwordInput);
    this.submitButton = page.locator(LOGIN_SELECTORS.submitButton);
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async submit(credentials: Credentials): Promise<void> {
    await this.emailInput.fill(credentials.email);
    await this.passwordInput.fill(credentials.password);
    await this.submitButton.click();
  }

  async expectErrorToast(): Promise<void> {
    await this.page
      .locator('[data-sonner-toast][data-type="error"]')
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.network });
  }
}
