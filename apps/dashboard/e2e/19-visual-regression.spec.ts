import { test, expect } from '@playwright/test';

const pages = [
  { name: 'login', path: '/login' },
  { name: 'forgot-password', path: '/forgot-password' },
  { name: 'register', path: '/register' },
];

for (const pageConfig of pages) {
  test(`visual regression: ${pageConfig.name} (ar)`, async ({ page }) => {
    await page.goto(pageConfig.path);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${pageConfig.name}-ar.png`, {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });
}

test.describe('Visual: Authenticated Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="phone"]', '+966512345678');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  const authPages = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'appointments', path: '/dashboard/appointments' },
    { name: 'clients', path: '/dashboard/clients' },
    { name: 'services', path: '/dashboard/services' },
    { name: 'employees', path: '/dashboard/employees' },
    { name: 'settings', path: '/dashboard/settings' },
  ];

  for (const pageConfig of authPages) {
    test(`visual: ${pageConfig.name}`, async ({ page }) => {
      await page.goto(pageConfig.path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${pageConfig.name}-ar.png`, {
        maxDiffPixelRatio: 0.02,
        fullPage: true,
      });
    });
  }
});
