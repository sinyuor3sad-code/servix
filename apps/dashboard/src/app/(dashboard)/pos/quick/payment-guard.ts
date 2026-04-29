import { evaluatePOSPaymentGuard } from '../pos-engine';

export type QuickSplitEntry = {
  method: string;
  amount: number;
};

export function evaluateQuickPOSPaymentGuard(input: {
  canPay: boolean;
  total: number;
  method: string;
  cashReceived?: string | number;
  splits?: QuickSplitEntry[];
}): { ok: boolean; message?: string } {
  if (!input.canPay) return { ok: false, message: 'أكمل بيانات العميل' };
  return evaluatePOSPaymentGuard({
    cartCount: 1,
    total: input.total,
    method: input.method,
    cashReceived: input.cashReceived,
    discountNeedsReason: false,
    discountExceedsLimit: false,
    pinOverrideApproved: false,
    couponCode: '',
    couponApplied: false,
    couponPending: false,
    splits: input.splits,
  });
}
