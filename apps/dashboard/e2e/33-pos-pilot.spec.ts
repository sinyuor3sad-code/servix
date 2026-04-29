import type { Locator, Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';

type CheckoutBody = {
  idempotencyKey?: string;
  terminalId?: string;
  shiftId?: string;
  couponCode?: string;
  items?: Array<Record<string, unknown>>;
  payments?: Array<{
    method?: string;
    amount?: number;
    cashReceived?: number;
  }>;
};

type PilotApiState = {
  checkoutBodies: CheckoutBody[];
  legacyCheckoutWrites: string[];
  couponValidations: Array<Record<string, unknown>>;
  openShiftCalls: number;
  paths: string[];
  consoleErrors: string[];
  pageErrors: string[];
};

const tenant = {
  id: 'pilot-tenant',
  nameAr: 'صالون اختبار',
  nameEn: 'Pilot Salon',
  slug: 'pilot-salon',
  logoUrl: null,
  primaryColor: '#a855f7',
  theme: 'velvet',
  status: 'active',
  trialEndsAt: null,
  phone: '+966500000000',
  email: 'pilot@example.test',
  city: 'Riyadh',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const user = {
  id: 'pilot-cashier',
  fullName: 'Pilot Cashier',
  email: 'cashier@example.test',
  phone: '+966500000001',
  avatarUrl: null,
  isEmailVerified: true,
  isPhoneVerified: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const tenantUser = {
  id: 'pilot-tu',
  tenantId: tenant.id,
  userId: user.id,
  roleId: 'pilot-role-cashier',
  isOwner: false,
  status: 'active',
  tenant,
  role: {
    id: 'pilot-role-cashier',
    name: 'cashier',
    nameAr: 'كاشير',
    isSystem: true,
  },
};

const authStorageValue = JSON.stringify({
  state: {
    user,
    accessToken: 'pilot-access-token',
    refreshToken: 'pilot-refresh-token',
    currentTenant: tenant,
    userRole: 'cashier',
    isOwner: false,
  },
  version: 0,
});

test.use({
  storageState: {
    cookies: [],
    origins: [{
      origin: 'http://localhost:3000',
      localStorage: [
        { name: 'servix-auth', value: authStorageValue },
        { name: 'pos_favs', value: JSON.stringify(['s1']) },
        { name: 'quick_pos_favs', value: JSON.stringify(['s1']) },
      ],
    }],
  },
});

const categories = [
  { id: 'c1', nameAr: 'شعر', nameEn: 'Hair', sortOrder: 1, isActive: true },
];

const services = [
  {
    id: 's1',
    categoryId: 'c1',
    nameAr: 'قص شعر',
    nameEn: 'Haircut',
    descriptionAr: null,
    price: 80,
    duration: 30,
    isActive: true,
    sortOrder: 1,
    imageUrl: null,
  },
];

const employees = [
  {
    id: 'e1',
    userId: null,
    fullName: 'سارة الاختبار',
    phone: null,
    email: null,
    role: 'stylist',
    commissionType: 'percentage',
    commissionValue: 10,
    isActive: true,
    salary: 0,
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const openShift = {
  id: 'pilot-shift',
  terminalId: 'POS-01',
  status: 'open',
  openingBalance: 0,
  openedAt: '2026-04-29T08:00:00.000Z',
  closedAt: null,
};

function success<T>(data: T) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  };
}

function apiError(status: number, message: string) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, message, statusCode: status }),
  };
}

async function installPilotAuth(page: Page) {
  await page.addInitScript(({ user, tenant }) => {
    window.localStorage.setItem('servix-auth', JSON.stringify({
      state: {
        user,
        accessToken: 'pilot-access-token',
        refreshToken: 'pilot-refresh-token',
        currentTenant: tenant,
        userRole: 'cashier',
        isOwner: false,
      },
      version: 0,
    }));
    window.localStorage.setItem('pos_favs', JSON.stringify(['s1']));
    window.localStorage.setItem('quick_pos_favs', JSON.stringify(['s1']));
    (window as unknown as { __servixPrintCalled: boolean; print: () => void }).__servixPrintCalled = false;
    window.print = () => {
      (window as unknown as { __servixPrintCalled: boolean }).__servixPrintCalled = true;
    };
  }, { user, tenant });
}

async function writePilotAuthStorage(page: Page) {
  await page.evaluate(({ authStorageValue }) => {
    window.localStorage.setItem('servix-auth', authStorageValue);
    window.localStorage.setItem('pos_favs', JSON.stringify(['s1']));
    window.localStorage.setItem('quick_pos_favs', JSON.stringify(['s1']));
  }, { authStorageValue });
}

async function installPilotApi(page: Page, options: { initialShiftOpen?: boolean; checkoutDelayMs?: number } = {}) {
  const state: PilotApiState = {
    checkoutBodies: [],
    legacyCheckoutWrites: [],
    couponValidations: [],
    openShiftCalls: 0,
    paths: [],
    consoleErrors: [],
    pageErrors: [],
  };
  const completedByKey = new Map<string, unknown>();
  let shiftIsOpen = options.initialShiftOpen ?? true;

  page.on('pageerror', (err) => {
    if (err.message.includes('Hydration failed') && err.message.includes('url="/login"')) return;
    state.pageErrors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('/ws') || text.includes('WebSocket') || text.includes('ERR_CONNECTION')) return;
    if (text.startsWith('Failed to load resource:')) return;
    state.consoleErrors.push(text);
  });

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    state.paths.push(`${method} ${path}`);
    const postData = request.postData();
    const body = postData ? JSON.parse(postData) as Record<string, unknown> : {};

    if (method === 'POST' && (path === '/invoices' || /^\/invoices\/[^/]+\/(discount|pay)$/.test(path))) {
      state.legacyCheckoutWrites.push(`${method} ${path}`);
    }

    if (path === '/auth/me') {
      await route.fulfill(success({ user, tenants: [tenantUser] }));
      return;
    }

    if (path === '/settings') {
      await route.fulfill(success({ onboarding_completed: 'true', whatsapp_enabled: 'false' }));
      return;
    }

    if (path.includes('/services/categories')) {
      await route.fulfill(success(categories));
      return;
    }

    if (path.endsWith('/services') || path.includes('/services?')) {
      await route.fulfill(success({ items: services, total: services.length, page: 1, limit: 100, totalPages: 1 }));
      return;
    }

    if (path.endsWith('/employees')) {
      await route.fulfill(success({ items: employees, total: employees.length, page: 1, limit: 50, totalPages: 1 }));
      return;
    }

    if (path.endsWith('/clients')) {
      await route.fulfill(success({ items: [], total: 0, page: 1, limit: 5, totalPages: 0 }));
      return;
    }

    if (path === '/salon') {
      await route.fulfill(success({ taxRate: 15 }));
      return;
    }

    if (path.includes('/pos-shifts/current')) {
      await route.fulfill(shiftIsOpen ? success(openShift) : apiError(404, 'No open shift'));
      return;
    }

    if (path.includes('/pos-shifts/open') && method === 'POST') {
      state.openShiftCalls += 1;
      shiftIsOpen = true;
      await route.fulfill(success(openShift));
      return;
    }

    if (path === '/coupons/validate' && method === 'POST') {
      state.couponValidations.push(body);
      const code = String(body.code ?? '').toUpperCase();
      await route.fulfill(success(code === 'SAVE10'
        ? { valid: true, discountAmount: 10, message: 'valid coupon' }
        : { valid: false, discountAmount: 0, message: 'invalid coupon' }));
      return;
    }

    if (path === '/pos/checkout' && method === 'POST') {
      const checkoutBody = body as CheckoutBody;
      state.checkoutBodies.push(checkoutBody);
      if (options.checkoutDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.checkoutDelayMs));
      }

      const cached = checkoutBody.idempotencyKey ? completedByKey.get(checkoutBody.idempotencyKey) : null;
      if (cached) {
        await route.fulfill(success(cached));
        return;
      }

      const payments = checkoutBody.payments ?? [];
      const total = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const couponDiscount = checkoutBody.couponCode ? 10 : 0;
      const taxableSubtotal = Math.max(0, 80 - couponDiscount);
      const receiptSnapshot = {
        version: 1,
        invoiceId: `pilot-invoice-${completedByKey.size + 1}`,
        invoiceNumber: `PILOT-${String(completedByKey.size + 1).padStart(4, '0')}`,
        publicToken: `pilot-token-${completedByKey.size + 1}`,
        issuedAt: new Date().toISOString(),
        terminalId: checkoutBody.terminalId,
        shiftId: checkoutBody.shiftId,
        client: { fullName: 'Walk-in' },
        items: [
          {
            serviceId: 's1',
            description: 'قص شعر',
            employeeId: 'e1',
            employeeName: 'سارة الاختبار',
            quantity: 1,
            unitPrice: 80,
            total: 80,
          },
        ],
        discounts: checkoutBody.couponCode
          ? [{ kind: 'coupon', code: checkoutBody.couponCode, amount: couponDiscount }]
          : [],
        subtotal: 80,
        discountTotal: couponDiscount,
        taxableSubtotal,
        taxRatePercent: 15,
        taxAmount: Number((taxableSubtotal * 0.15).toFixed(2)),
        total,
        payments: payments.map((payment) => ({
          ...payment,
          changeAmount: payment.method === 'cash'
            ? Math.max(0, Number(payment.cashReceived ?? 0) - Number(payment.amount ?? 0))
            : null,
        })),
      };
      const response = {
        checkoutId: checkoutBody.idempotencyKey,
        idempotencyKey: checkoutBody.idempotencyKey,
        invoice: {
          id: receiptSnapshot.invoiceId,
          invoiceNumber: receiptSnapshot.invoiceNumber,
          status: 'paid',
          total,
          publicToken: receiptSnapshot.publicToken,
        },
        receiptSnapshot,
        nextActions: { canSendInvoice: true, canSubmitZatca: true },
      };
      if (checkoutBody.idempotencyKey) completedByKey.set(checkoutBody.idempotencyKey, response);
      await route.fulfill(success(response));
      return;
    }

    await route.fulfill(success({}));
  });

  return state;
}

function assertNoClientFinancialTruth(body: CheckoutBody) {
  const text = JSON.stringify(body);
  expect(text).not.toContain('unitPrice');
  expect(text).not.toContain('subtotal');
  expect(text).not.toContain('tax');
  expect(text).not.toContain('total');
}

function expectNoRuntimeErrors(state: PilotApiState) {
  expect(state.pageErrors).toEqual([]);
  expect(state.consoleErrors).toEqual([]);
}

async function expectQuickServiceReady(page: Page, apiState: PilotApiState) {
  const serviceButton = page.getByTestId('quick-pos-service-s1');
  if (!await waitForVisible(serviceButton, 7_500)) {
    throw new Error(`Quick POS service fixture did not render. API paths: ${apiState.paths.join(', ')}`);
  }
}

async function waitForVisible(locator: Locator, timeout: number) {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}

async function gotoWithPilotAuth(page: Page, path: string, apiState?: PilotApiState) {
  await page.goto('/login');
  await writePilotAuthStorage(page);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('servix-auth'))).toContain('pilot-access-token');
  apiState?.pageErrors.splice(0);
  apiState?.consoleErrors.splice(0);
  await page.goto(path);
}

async function gotoMainPOSReady(page: Page, apiState: PilotApiState) {
  await gotoWithPilotAuth(page, '/pos', apiState);
  const serviceButton = page.getByTestId('pos-service-s1');
  await expect(page.locator('[data-testid="pos-service-s1"], input[type="number"]').first()).toBeVisible();
  if (await waitForVisible(serviceButton, 250)) return;

  const openButton = page.getByTestId('pos-open-shift-button');
  let openedShift = false;
  if (await waitForVisible(openButton, 5_000)) {
    const previousOpenCalls = apiState.openShiftCalls;
    await page.getByTestId('pos-open-shift-amount').fill('0');
    await openButton.click();
    await expect.poll(() => apiState.openShiftCalls).toBe(previousOpenCalls + 1);
    openedShift = true;
  } else if (await waitForVisible(page.locator('input[type="number"]').first(), 500)) {
    const previousOpenCalls = apiState.openShiftCalls;
    await page.locator('input[type="number"]').first().fill('0');
    await page.locator('button').nth(5).click();
    await expect.poll(() => apiState.openShiftCalls).toBe(previousOpenCalls + 1);
    openedShift = true;
  }
  if (openedShift && await waitForVisible(serviceButton, 5_000)) return;

  if (!await waitForVisible(serviceButton, 3_000)) {
    await writePilotAuthStorage(page);
    await page.reload();
  }
  if (!await waitForVisible(serviceButton, 7_500)) {
    throw new Error(`Main POS did not render after shift setup. API paths: ${apiState.paths.join(', ')}`);
  }
}

test.describe('POS atomic checkout pilot', () => {
  test.describe.configure({ mode: 'serial' });

  test('main POS opens a shift, cash-checks out once on duplicate click, and prints server snapshot', async ({ page }) => {
    await installPilotAuth(page);
    const apiState = await installPilotApi(page, { initialShiftOpen: false, checkoutDelayMs: 500 });

    await gotoMainPOSReady(page, apiState);
    expect(apiState.openShiftCalls).toBe(1);

    await page.getByTestId('pos-service-s1').click();
    await page.getByTestId('pos-cash-received').fill('100');
    await page.getByTestId('pos-checkout-button').click();
    await page.getByTestId('pos-checkout-button').click({ timeout: 250 }).catch(() => undefined);

    await expect(page.getByTestId('pos-success-modal')).toBeVisible();
    expect(apiState.checkoutBodies).toHaveLength(1);
    expect(apiState.legacyCheckoutWrites).toEqual([]);
    assertNoClientFinancialTruth(apiState.checkoutBodies[0]);
    expect(apiState.checkoutBodies[0].payments).toEqual([
      expect.objectContaining({ method: 'cash', amount: 92, cashReceived: 100 }),
    ]);
    await expect(page.locator('[data-last-receipt-source="server"]').first()).toBeVisible();

    await page.getByTestId('pos-success-close').dispatchEvent('click');
    await expect(page.getByTestId('pos-success-modal')).toBeHidden();
    await page.getByTestId('pos-print-last-receipt').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __servixPrintCalled?: boolean }).__servixPrintCalled)).toBe(true);
    expectNoRuntimeErrors(apiState);
  });

  test('main POS sends a validated coupon code to atomic checkout', async ({ page }) => {
    await installPilotAuth(page);
    const apiState = await installPilotApi(page);

    await gotoMainPOSReady(page, apiState);
    await page.getByTestId('pos-service-s1').click();
    await page.getByTestId('pos-coupon-code').fill('SAVE10');
    await expect.poll(() => apiState.couponValidations.length).toBe(1);
    await page.getByTestId('pos-cash-received').fill('100');
    await page.getByTestId('pos-checkout-button').click();
    await expect(page.getByTestId('pos-success-modal')).toBeVisible();
    expect(apiState.checkoutBodies[0].couponCode).toBe('SAVE10');
    assertNoClientFinancialTruth(apiState.checkoutBodies[0]);
    expectNoRuntimeErrors(apiState);
  });

  test('main POS card checkout uses atomic checkout without cashReceived', async ({ page }) => {
    await installPilotAuth(page);
    const apiState = await installPilotApi(page);

    await gotoMainPOSReady(page, apiState);
    await page.getByTestId('pos-service-s1').click();
    await page.getByTestId('pos-payment-card').click();
    await page.getByTestId('pos-checkout-button').click();

    await expect(page.getByTestId('pos-success-modal')).toBeVisible();
    expect(apiState.checkoutBodies).toHaveLength(1);
    expect(apiState.legacyCheckoutWrites).toEqual([]);
    assertNoClientFinancialTruth(apiState.checkoutBodies[0]);
    expect(apiState.checkoutBodies[0].payments).toEqual([
      expect.objectContaining({ method: 'card', amount: 92 }),
    ]);
    expect(apiState.checkoutBodies[0].payments?.[0]).not.toHaveProperty('cashReceived');
    await expect(page.locator('[data-last-receipt-source="server"]').first()).toBeVisible();
    expectNoRuntimeErrors(apiState);
  });

  test('main POS blocks invalid coupon checkout', async ({ page }) => {
    await installPilotAuth(page);
    const apiState = await installPilotApi(page);

    await gotoMainPOSReady(page, apiState);
    await page.getByTestId('pos-service-s1').click();
    await page.getByTestId('pos-coupon-code').fill('BAD');
    await expect.poll(() => apiState.couponValidations.length).toBe(1);
    await page.getByTestId('pos-cash-received').fill('100');
    await expect(page.getByTestId('pos-checkout-button')).toBeDisabled();
    expect(apiState.checkoutBodies).toHaveLength(0);
    expectNoRuntimeErrors(apiState);
  });

  test('quick POS card checkout uses atomic checkout and keeps the server receipt snapshot', async ({ page }) => {
    await installPilotAuth(page);
    const apiState = await installPilotApi(page);

    await gotoWithPilotAuth(page, '/pos/quick', apiState);
    await expectQuickServiceReady(page, apiState);
    await page.getByTestId('quick-pos-service-s1').click();
    await page.getByTestId('quick-pos-payment-card').click();

    await expect(page.locator('[data-last-receipt-source="server"]').first()).toBeVisible();
    expect(apiState.checkoutBodies).toHaveLength(1);
    expect(apiState.legacyCheckoutWrites).toEqual([]);
    assertNoClientFinancialTruth(apiState.checkoutBodies[0]);
    expect(apiState.checkoutBodies[0].payments).toEqual([
      expect.objectContaining({ method: 'card', amount: 92 }),
    ]);
    expectNoRuntimeErrors(apiState);
  });

  test('quick POS split cash/card checkout is submitted as one atomic payments array', async ({ page }) => {
    await installPilotAuth(page);
    const apiState = await installPilotApi(page);

    await gotoWithPilotAuth(page, '/pos/quick', apiState);
    await expectQuickServiceReady(page, apiState);
    await page.getByTestId('quick-pos-service-s1').click();
    await page.getByTestId('quick-pos-split-open').click();
    await page.getByTestId('quick-pos-split-amount-0').fill('40');
    await page.getByTestId('quick-pos-split-amount-1').fill('52');
    await page.getByTestId('quick-pos-split-cash-received').fill('40');
    await page.getByTestId('quick-pos-split-confirm').click();

    await expect(page.locator('[data-last-receipt-source="server"]').first()).toBeVisible();
    expect(apiState.checkoutBodies).toHaveLength(1);
    expect(apiState.legacyCheckoutWrites).toEqual([]);
    assertNoClientFinancialTruth(apiState.checkoutBodies[0]);
    expect(apiState.checkoutBodies[0].payments).toEqual([
      expect.objectContaining({ method: 'cash', amount: 40, cashReceived: 40 }),
      expect.objectContaining({ method: 'card', amount: 52 }),
    ]);
    expectNoRuntimeErrors(apiState);
  });
});
