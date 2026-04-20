import { api } from '@/lib/api';

export type LoyaltyMode = 'points' | 'visits' | 'both';

export interface LoyaltySettings {
  loyaltyEnabled: boolean;
  loyaltyMode: LoyaltyMode;
  loyaltyPointsPerSar: number;
  loyaltyRedemptionValue: number;
  loyaltyVisitsPerReward: number;
  loyaltyVisitRewardValue: number;
  // legacy keys some callers may still read
  pointsPerSar?: number;
  redemptionValue?: number;
  minimumRedemption?: number;
}

export interface UpdateLoyaltySettingsPayload {
  loyaltyEnabled?: boolean;
  loyaltyMode?: LoyaltyMode;
  loyaltyPointsPerSar?: number;
  loyaltyRedemptionValue?: number;
  loyaltyVisitsPerReward?: number;
  loyaltyVisitRewardValue?: number;
}

export const loyaltyService = {
  getSettings: (token: string) =>
    api.get<LoyaltySettings>('/loyalty/settings', token),

  updateSettings: (token: string, body: UpdateLoyaltySettingsPayload) =>
    api.put<LoyaltySettings>('/loyalty/settings', body, token),

  adjustVisits: (
    token: string,
    clientId: string,
    body: { visits: number; description: string },
  ) => api.post<unknown>(`/loyalty/clients/${clientId}/adjust-visits`, body, token),

  redeemVisits: (
    token: string,
    clientId: string,
    body: { visits: number; invoiceId: string },
  ) => api.post<{ discount: number }>(`/loyalty/clients/${clientId}/redeem-visits`, body, token),
};
