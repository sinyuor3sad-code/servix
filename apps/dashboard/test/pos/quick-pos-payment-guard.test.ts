import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateQuickPOSPaymentGuard } from '@/app/(dashboard)/pos/quick/payment-guard';

function readQuickPOSSource(): string {
  const candidates = [
    resolve(process.cwd(), 'src/app/(dashboard)/pos/quick/page.tsx'),
    resolve(process.cwd(), 'apps/dashboard/src/app/(dashboard)/pos/quick/page.tsx'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) throw new Error('Quick POS page source not found');
  return readFileSync(file, 'utf8');
}

describe('/pos/quick payment guard', () => {
  it('rejects split overpay', () => {
    const result = evaluateQuickPOSPaymentGuard({
      canPay: true,
      total: 115,
      method: 'split',
      cashReceived: '60',
      splits: [
        { method: 'cash', amount: 60 },
        { method: 'card', amount: 60 },
      ],
    });

    expect(result.ok).toBe(false);
  });

  it('rejects split underpay', () => {
    const result = evaluateQuickPOSPaymentGuard({
      canPay: true,
      total: 115,
      method: 'split',
      cashReceived: '50',
      splits: [
        { method: 'cash', amount: 50 },
        { method: 'card', amount: 60 },
      ],
    });

    expect(result.ok).toBe(false);
  });

  it('rejects cash payment without cashReceived', () => {
    const result = evaluateQuickPOSPaymentGuard({
      canPay: true,
      total: 115,
      method: 'cash',
    });

    expect(result.ok).toBe(false);
  });

  it('uses atomic posCheckout instead of legacy invoice/pay calls in checkout path', () => {
    const source = readQuickPOSSource();
    const start = source.indexOf('const payMut = useMutation');
    const end = source.indexOf('const refMut = useMutation', start);
    const checkoutPath = source.slice(start, end);

    expect(checkoutPath).toContain('dashboardService.posCheckout');
    expect(checkoutPath).not.toContain("'/invoices'");
    expect(checkoutPath).not.toContain('"/invoices"');
    expect(checkoutPath).not.toContain('addInvoiceDiscount');
    expect(checkoutPath).not.toContain('recordInvoicePayment');
    expect(checkoutPath).not.toContain('sendInvoice');
  });

  it('keeps server receiptSnapshot after clearAll in quick checkout success', () => {
    const source = readQuickPOSSource();
    const start = source.indexOf('onSuccess: (checkout, method)');
    const end = source.indexOf('onError:', start);
    const successPath = source.slice(start, end);

    expect(successPath).toContain('normalizeServerReceiptSnapshot(checkout.receiptSnapshot, method)');
    expect(successPath.indexOf('setLastPaidSnapshot(receiptSnapshot)')).toBeGreaterThan(-1);
    expect(successPath.indexOf('setLastPaidSnapshot(receiptSnapshot)')).toBeLessThan(successPath.indexOf('clearAll()'));
  });

  it('blocks quick checkout via kill switch before calling posCheckout or legacy flow', () => {
    const source = readQuickPOSSource();
    const start = source.indexOf('function pay(m: string)');
    const end = source.indexOf('const refMut = useMutation', start);
    const payPath = source.slice(start, end);

    expect(payPath).toContain('isAtomicPOSCheckoutEnabled');
    expect(payPath.indexOf('isAtomicPOSCheckoutEnabled')).toBeLessThan(payPath.indexOf('payMut.mutate'));
    expect(payPath).not.toContain("'/invoices'");
    expect(payPath).not.toContain('recordInvoicePayment');
  });

  it('records quick checkout diagnostics without persisting PII or cart payloads', () => {
    const source = readQuickPOSSource();

    expect(source).toContain('lastCheckoutDiagnostic');
    expect(source).toContain('checkoutDiagnostics');
    expect(source).toContain('appendCheckoutDiagnostic');
    expect(source).toContain('data-checkout-diagnostics-count');
    expect(source).toContain("source: 'quick-pos'");
    expect(source).toContain("status: 'completed'");
    expect(source).toContain("status: 'failed'");
    expect(source).toContain("status: 'blocked'");
    expect(source).not.toMatch(/sessionStorage/i);
    expect(source).not.toMatch(/localStorage\.setItem\(['"]qpos_checkout/i);
    expect(source).not.toMatch(/lastCheckoutDiagnostic[\s\S]{0,160}localStorage/i);
  });

  it('does not show an inactive WhatsApp checkout toggle in quick POS', () => {
    const source = readQuickPOSSource();

    expect(source).not.toContain('sendWA');
    expect(source).not.toContain('setSendWA');
    expect(source).not.toContain('إرسال واتساب');
  });
});
