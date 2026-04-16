import type { Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../helpers/constants';

export class AppointmentsPage {
  readonly page: Page;
  /** Any of: calendar grid, list table, or empty-state marker. */
  readonly surface: Locator;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.surface = page.locator(
      'table, [data-testid="appointments-list"], [data-testid="calendar"], [role="grid"]',
    );
    this.addButton = page.getByRole('button', { name: /إضافة|جديد|new|add/i }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/appointments');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.network }).catch(() => {
      /* networkidle is best-effort */
    });
  }

  async openNewDialog(): Promise<void> {
    await this.addButton.click();
  }
}
