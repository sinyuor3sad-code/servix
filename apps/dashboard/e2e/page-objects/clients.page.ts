import type { Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../helpers/constants';

export class ClientsPage {
  readonly page: Page;
  readonly list: Locator;
  readonly searchInput: Locator;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.list = page.locator('table, [data-testid="clients-list"], [role="table"]');
    this.searchInput = page.locator(
      'input[type="search"], input[placeholder*="بحث"], input[placeholder*="search" i]',
    );
    this.addButton = page.getByRole('button', { name: /إضافة|جديد|new|add/i }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/clients');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.network }).catch(() => {
      /* best-effort */
    });
  }

  async search(term: string): Promise<void> {
    await this.searchInput.first().fill(term);
  }
}
