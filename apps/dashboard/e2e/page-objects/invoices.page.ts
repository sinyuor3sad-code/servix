import type { Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../helpers/constants';

export class InvoicesPage {
  readonly page: Page;
  readonly list: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.list = page.locator('table, [data-testid="invoices-list"], [role="table"]');
    this.createButton = page
      .getByRole('button', { name: /إنشاء|جديد|new|create|add/i })
      .first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/invoices');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.network }).catch(() => {
      /* best-effort */
    });
  }
}
