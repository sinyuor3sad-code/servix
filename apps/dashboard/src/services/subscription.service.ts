import { api } from '@/lib/api';

export interface SubscriptionInfo {
  id: string;
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  planId: string;
  plan?: {
    id: string;
    name: string;
    nameAr: string;
    price: number;
    billingCycle: string;
  };
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  createdAt: string;
}

export const subscriptionService = {
  getCurrent: (token: string) =>
    api.get<SubscriptionInfo>('/subscriptions/current', token),
};
