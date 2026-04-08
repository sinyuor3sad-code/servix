import { test, expect } from '@playwright/test';

/**
 * Accessibility Tests — WCAG 2.1 AA
 * Uses Playwright built-in accessibility snapshot testing.
 * For full axe-core analysis, install @axe-core/playwright.
 */

const pages = [
  { name: 'Login', path: '/login' },
  { name: 'Register', path: '/register' },
  { name: 'Forgot Password', path: '/forgot-password' },
];

for (const pageConfig of pages) {
  test(`a11y: ${pageConfig.name} — all images have alt text`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt, `Image ${i} missing alt text`).toBeTruthy();
    }
  });

  test(`a11y: ${pageConfig.name} — all form inputs have labels`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');

      const hasLabel = id ? await page.locator(`label[for="${id}"]`).count() > 0 : false;
      const isAccessible = hasLabel || !!ariaLabel || !!ariaLabelledBy || !!placeholder;
      expect(isAccessible, `Input ${i} (id=${id}) lacks accessible label`).toBeTruthy();
    }
  });

  test(`a11y: ${pageConfig.name} — page has heading`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.waitForLoadState('networkidle');

    const headings = page.locator('h1, h2, h3');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test(`a11y: ${pageConfig.name} — buttons have text`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      expect(
        (text && text.trim().length > 0) || !!ariaLabel || !!title,
        `Button ${i} has no accessible text`,
      ).toBeTruthy();
    }
  });
}
