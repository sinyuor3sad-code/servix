import { test as base, expect, type Page } from '@playwright/test';
import { AppointmentsPage } from './page-objects/appointments.page';
import { ClientsPage } from './page-objects/clients.page';
import { InvoicesPage } from './page-objects/invoices.page';
import { LoginPage } from './page-objects/login.page';

export interface ServixFixtures {
  /** Pre-authenticated page (uses storageState from global-setup). */
  authedPage: Page;
  loginPage: LoginPage;
  appointmentsPage: AppointmentsPage;
  clientsPage: ClientsPage;
  invoicesPage: InvoicesPage;
}

/**
 * The `test` export every spec should use instead of @playwright/test's raw
 * `test`. Provides page objects and a type-safe `authedPage` alias.
 *
 * Projects configured with `storageState` will deliver already-authenticated
 * pages, so tests that use `authedPage` don't re-log in.
 */
export const test = base.extend<ServixFixtures>({
  authedPage: async ({ page }, use) => {
    await use(page);
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  appointmentsPage: async ({ page }, use) => {
    await use(new AppointmentsPage(page));
  },
  clientsPage: async ({ page }, use) => {
    await use(new ClientsPage(page));
  },
  invoicesPage: async ({ page }, use) => {
    await use(new InvoicesPage(page));
  },
});

export { expect };
