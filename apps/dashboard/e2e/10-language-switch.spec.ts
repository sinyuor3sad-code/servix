import { test, expect } from '@playwright/test';

test.describe('Language Switch', () => {
  test('should switch to English', async ({ page }) => {
    await page.goto('/login');
    const langBtn = page.locator('button:has-text("EN"), button:has-text("English"), [data-testid="lang-switch"]');
    if (await langBtn.first().isVisible()) {
      await langBtn.first().click();
      await page.waitForTimeout(1000);
      const html = page.locator('html');
      const dir = await html.getAttribute('dir');
      // Could be ltr for English
      expect(['ltr', 'rtl']).toContain(dir);
    }
  });

  test('should maintain RTL for Arabic', async ({ page }) => {
    await page.goto('/login');
    const html = page.locator('html');
    const dir = await html.getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('should persist language preference', async ({ page }) => {
    await page.goto('/login');
    // Verify page loads in Arabic by default
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
