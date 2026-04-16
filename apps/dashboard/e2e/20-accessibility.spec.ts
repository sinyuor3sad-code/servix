import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

/**
 * WCAG 2.1 AA accessibility scans for public pages.
 *
 * Uses @axe-core/playwright to run the full axe ruleset. Tests fail if any
 * serious or critical violation is found. Moderate/minor violations are
 * reported but don't fail the build (tracked in `report.violations`).
 */

const PUBLIC_PAGES = [
  { name: 'Login', path: '/login' },
  { name: 'Register', path: '/register' },
  { name: 'Forgot Password', path: '/forgot-password' },
] as const;

for (const pageConfig of PUBLIC_PAGES) {
  test(`a11y: ${pageConfig.name} has no serious/critical axe violations`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );

    expect(serious, formatViolations(serious)).toEqual([]);
  });
}

function formatViolations(violations: Array<{ id: string; impact: string | null | undefined; help: string; nodes: Array<{ target: unknown }> }>): string {
  if (!violations.length) return '';
  return violations
    .map((v) => `  • [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`)
    .join('\n');
}
