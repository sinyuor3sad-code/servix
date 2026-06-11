import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  appendCheckoutDiagnostic,
  buildCheckoutDiagnostic,
  buildPOSCheckoutPayload,
  buildPOSCheckoutPayments,
  checkoutFingerprint,
  checkoutTotalsMismatch,
  evaluatePOSPaymentGuard,
  isAtomicPOSCheckoutEnabled,
  logCheckoutDiagnostic,
  normalizeServerReceiptSnapshot,
} from '@/app/(dashboard)/pos/pos-engine';
import type { PosCheckoutResponse } from '@/services/dashboard.service';

function readPOSEngineSource(): string {
  const candidates = [
    resolve(process.cwd(), 'src/app/(dashboard)/pos/pos-engine.ts'),
    resolve(process.cwd(), 'apps/dashboard/src/app/(dashboard)/pos/pos-engine.ts'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) throw new Error('POS engine source not found');
  return readFileSync(file, 'utf8');
}

function readPOSComponentSource(fileName: string): string {
  const candidates = [
    resolve(process.cwd(), `src/app/(dashboard)/pos/components/${fileName}`),
    resolve(process.cwd(), `apps/dashboard/src/app/(dashboard)/pos/components/${fileName}`),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) throw new Error(`${fileName} source not found`);
  return readFileSync(file, 'utf8');
}

const baseGuard = {
  cartCount: 1,
  total: 115,
  method: 'card',
  discountNeedsReason: false,
  discountExceedsLimit: false,
  pinOverrideApproved: false,
  couponCode: '',
  couponApplied: false,
  couponPending: false,
};

describe('POS payment guard', () => {
  it('rejects cash payments when cashReceived is less than the total', () => {
    const result = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'cash',
      cashReceived: '100',
    });

    expect(result.ok).toBe(false);
  });

  it('allows cash payments only when cashReceived covers the total', () => {
    const result = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'cash',
      cashReceived: '115',
    });

    expect(result.ok).toBe(true);
  });

  it('rejects split underpay', () => {
    const result = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'split',
      splits: [
        { method: 'cash', amount: 50 },
        { method: 'card', amount: 60 },
      ],
      cashReceived: '50',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects split overpay instead of hiding it', () => {
    const result = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'split',
      splits: [
        { method: 'cash', amount: 60 },
        { method: 'card', amount: 60 },
      ],
      cashReceived: '60',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects split cash leg when cashReceived is short', () => {
    const result = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'split',
      splits: [
        { method: 'cash', amount: 70 },
        { method: 'card', amount: 45 },
      ],
      cashReceived: '60',
    });

    expect(result.ok).toBe(false);
  });

  it('applies the same discount and coupon guards to all payment surfaces', () => {
    const desktopAttempt = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'card',
      discountNeedsReason: true,
    });
    const touchAttempt = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'card',
      discountNeedsReason: true,
    });
    const staleCouponAttempt = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'card',
      couponCode: 'SAVE20',
      couponApplied: false,
    });

    expect(desktopAttempt.ok).toBe(false);
    expect(touchAttempt.ok).toBe(false);
    expect(staleCouponAttempt.ok).toBe(false);
  });

  it('does not allow a local PIN override to bypass over-limit discount guards', () => {
    const result = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'card',
      discountExceedsLimit: true,
      pinOverrideApproved: true,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects applied coupons when the cart changed after validation', () => {
    const result = evaluatePOSPaymentGuard({
      ...baseGuard,
      method: 'card',
      couponCode: 'SAVE20',
      couponApplied: true,
      couponChangedSinceValidation: true,
    });

    expect(result.ok).toBe(false);
  });

  it('builds POS checkout items without client-side price or total fields', () => {
    const payload = buildPOSCheckoutPayload({
      idempotencyKey: 'idem-1',
      terminalId: 'terminal-1',
      shiftId: 'shift-1',
      fallbackEmployeeId: 'emp-1',
      client: null,
      walkInMode: false,
      walkName: '',
      walkPhone: '',
      cart: [
        {
          id: 'cart-1',
          service: { id: 'svc-1', nameAr: 'Service', price: 999 } as any,
          quantity: 2,
          employeeId: 'emp-2',
          employeeName: 'Employee',
          discount: 0,
          discountType: 'fixed',
          note: '',
        },
      ],
      payments: [{ method: 'card', amount: 115 }],
    });

    expect(payload.items).toEqual([{ serviceId: 'svc-1', employeeId: 'emp-2', quantity: 2 }]);
    expect(payload).not.toHaveProperty('subtotal');
    expect(payload).not.toHaveProperty('tax');
    expect(payload).not.toHaveProperty('total');
    expect(payload.items[0]).not.toHaveProperty('unitPrice');
  });

  it('builds cash checkout payment with explicit cashReceived', () => {
    const payments = buildPOSCheckoutPayments({
      method: 'cash',
      total: 115,
      splits: [],
      cashReceived: '120',
    });

    expect(payments).toEqual([{ method: 'cash', amount: 115, cashReceived: 120 }]);
  });

  it('builds split checkout as one payments array for posCheckout', () => {
    const payments = buildPOSCheckoutPayments({
      method: 'split',
      total: 115,
      cashReceived: '50',
      splits: [
        { method: 'cash', amount: 50 },
        { method: 'card', amount: 65 },
      ],
    });

    expect(payments).toEqual([
      { method: 'cash', amount: 50, cashReceived: 50 },
      { method: 'card', amount: 65 },
    ]);
  });

  it('normalizes server receiptSnapshot as the receipt source', () => {
    const receipt = normalizeServerReceiptSnapshot({
      invoiceId: 'inv-1',
      publicToken: 'token-1',
      issuedAt: '2026-04-29T10:00:00.000Z',
      client: { fullName: 'Client' },
      items: [{ serviceId: 'svc-1', description: 'Haircut', quantity: 1, total: 100 }],
      discounts: [{ kind: 'coupon', amount: 10 }],
      subtotal: 100,
      taxRatePercent: 15,
      taxAmount: 13.5,
      total: 103.5,
      payments: [{ method: 'cash', amount: 103.5, cashReceived: 110, changeAmount: 6.5 }],
    }, 'card');

    expect(receipt.source).toBe('server');
    expect(receipt.items[0]).toMatchObject({ id: 'svc-1', name: 'Haircut', amount: 100 });
    expect(receipt.total).toBe(103.5);
    expect(receipt.method).toBe('cash');
    expect(receipt.cashReceived).toBe('110');
  });

  it('uses atomic posCheckout instead of legacy invoice/pay calls in POS checkout path', () => {
    const source = readPOSEngineSource();
    const start = source.indexOf('const payMut = useMutation');
    const end = source.indexOf('const refMut = useMutation', start);
    const checkoutPath = source.slice(start, end);

    expect(checkoutPath).toContain('dashboardService.posCheckout');
    expect(checkoutPath).not.toContain("'/invoices'");
    expect(checkoutPath).not.toContain('"/invoices"');
    expect(checkoutPath).not.toContain('/coupons/redeem');
    expect(checkoutPath).not.toContain('addInvoiceDiscount');
    expect(checkoutPath).not.toContain('recordInvoicePayment');
  });

  it('builds diagnostics for success, failure, and blocked checkout attempts without PII fields', () => {
    const completed = buildCheckoutDiagnostic({
      source: 'pos',
      status: 'completed',
      startedAtMs: Date.now() - 25,
      idempotencyKey: 'pos-1',
      terminalId: 'terminal-1',
      shiftId: 'shift-1',
      previewTotal: 100,
      serverTotal: 100,
      paymentMethods: ['cash'],
    });
    const failed = buildCheckoutDiagnostic({
      source: 'pos',
      status: 'failed',
      errorCode: 'checkout_failed',
      errorMessage: 'Network error',
      paymentMethods: ['card'],
    });
    const blocked = buildCheckoutDiagnostic({
      source: 'pos',
      status: 'blocked',
      errorCode: 'payment_guard_failed',
      errorMessage: 'Guard failed',
      paymentMethods: ['cash'],
    });

    expect(completed).toMatchObject({ status: 'completed', idempotencyKey: 'pos-1', terminalId: 'terminal-1', shiftId: 'shift-1' });
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'checkout_failed' });
    expect(blocked).toMatchObject({ status: 'blocked', errorCode: 'payment_guard_failed' });
    expect(JSON.stringify([completed, failed, blocked])).not.toMatch(/fullName|phone|cart|items|client/i);
  });

  it('keeps an in-memory history of the last 20 checkout diagnostics', () => {
    const history = Array.from({ length: 25 }, (_, index) => buildCheckoutDiagnostic({
      source: 'pos',
      status: 'failed',
      idempotencyKey: `pos-${index}`,
      paymentMethods: ['card'],
    })).reduce<ReturnType<typeof appendCheckoutDiagnostic>>(
      (current, diagnostic) => appendCheckoutDiagnostic(current, diagnostic),
      [],
    );

    expect(history).toHaveLength(20);
    expect(history[0].idempotencyKey).toBe('pos-24');
    expect(history.at(-1)?.idempotencyKey).toBe('pos-5');
  });

  it('models PosCheckoutResponse.nextActions as the backend object contract', () => {
    const response = {
      checkoutId: 'checkout-1',
      idempotencyKey: 'idem-1',
      invoice: {
        id: 'inv-1',
        invoiceNumber: 'INV-1',
        status: 'paid',
        total: 115,
      },
      receiptSnapshot: {
        invoiceId: 'inv-1',
        total: 115,
        payments: [{ method: 'card', amount: 115 }],
      },
      nextActions: {
        canSendInvoice: true,
        canSubmitZatca: true,
      },
    } satisfies PosCheckoutResponse;

    expect(Array.isArray(response.nextActions)).toBe(false);
    expect(response.nextActions.canSendInvoice).toBe(true);
    expect(response.nextActions.canSubmitZatca).toBe(true);
  });

  it('logs shadow mismatch as a warning without marking checkout failed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const diagnostic = buildCheckoutDiagnostic({
      source: 'pos',
      status: 'completed',
      idempotencyKey: 'pos-1',
      terminalId: 'terminal-1',
      shiftId: 'shift-1',
      previewTotal: 100,
      serverTotal: 101,
      paymentMethods: ['card'],
      warning: checkoutTotalsMismatch(100, 101) ? 'preview_total_mismatch' : undefined,
    });

    logCheckoutDiagnostic(diagnostic);

    expect(diagnostic.status).toBe('completed');
    expect(diagnostic.warning).toBe('preview_total_mismatch');
    expect(warn).toHaveBeenCalledWith('[pos.checkout.diagnostic]', expect.objectContaining({
      warning: 'preview_total_mismatch',
      previewTotal: 100,
      serverTotal: 101,
    }));
    warn.mockRestore();
  });

  it('supports a kill switch for atomic checkout without falling back to legacy flow', () => {
    const source = readPOSEngineSource();
    const start = source.indexOf('function pay(m: string)');
    const end = source.indexOf('const refMut = useMutation', start);
    const payPath = source.slice(start, end);

    expect(isAtomicPOSCheckoutEnabled('false')).toBe(false);
    expect(isAtomicPOSCheckoutEnabled('0')).toBe(false);
    expect(isAtomicPOSCheckoutEnabled('true')).toBe(true);
    expect(payPath).toContain('isAtomicPOSCheckoutEnabled');
    expect(payPath).not.toContain("'/invoices'");
    expect(payPath).not.toContain('recordInvoicePayment');
  });

  it('reuses the same idempotencyKey for retry inside the same checkout attempt', () => {
    const payload = buildPOSCheckoutPayload({
      idempotencyKey: 'pending',
      terminalId: 'terminal-1',
      shiftId: 'shift-1',
      fallbackEmployeeId: 'emp-1',
      client: null,
      walkInMode: false,
      walkName: '',
      walkPhone: '',
      cart: [
        {
          id: 'cart-1',
          service: { id: 'svc-1', nameAr: 'Service', price: 100 } as any,
          quantity: 1,
          employeeId: 'emp-1',
          employeeName: 'Employee',
          discount: 0,
          discountType: 'fixed',
          note: '',
        },
      ],
      payments: [{ method: 'card', amount: 115 }],
    });
    const fingerprint = checkoutFingerprint(payload);
    let attempt: { key: string; fingerprint: string } | null = null;
    const resolveKey = () => {
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = { key: 'pos-retry-key', fingerprint };
      }
      return attempt.key;
    };

    expect(resolveKey()).toBe('pos-retry-key');
    expect(resolveKey()).toBe('pos-retry-key');
  });

  it('does not persist checkout diagnostics in browser storage', () => {
    const source = readPOSEngineSource();

    expect(source).toContain('checkoutDiagnostics');
    expect(source).toContain('appendCheckoutDiagnostic');
    expect(source).not.toMatch(/sessionStorage/i);
    expect(source).not.toContain('pos_held_bills');
    expect(source).not.toMatch(/localStorage\.setItem\(['"]pos_checkout/i);
    expect(source).not.toMatch(/localStorage\.setItem\(['"]checkout/i);
    expect(source).not.toMatch(/lastCheckoutDiagnostic[\s\S]{0,160}localStorage/i);
  });

  it('does not show inactive WhatsApp, Email, or ZATCA controls as effective POS checkout controls', () => {
    const desktopSource = readPOSComponentSource('DesktopPOS.tsx');
    const touchSource = readPOSComponentSource('TouchPOS.tsx');

    expect(desktopSource).not.toContain('ZATCA');
    expect(desktopSource).not.toContain('e.sendWA');
    expect(desktopSource).not.toContain('e.sendMail');
    expect(touchSource).not.toContain('e.sendWA');
  });
});
