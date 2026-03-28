import { api } from '@/lib/api';

export type SalonSettings = Record<string, string>;

const DEV_SETTINGS: SalonSettings = {
  onboarding_completed: 'true',
  dashboard_theme: 'velvet',
  dashboard_mode: 'light',
  online_booking_enabled: 'true',
  whatsapp_enabled: 'false',
  vacation_mode: 'false',
  seasonal_themes_enabled: 'true',
};

export const settingsService = {
  getAll: (token: string) => {
    if (token === 'dev-access-token-mock') {
      return Promise.resolve(DEV_SETTINGS);
    }
    return api.get<SalonSettings>('/settings', token);
  },

  updateBatch: (token: string, settings: { key: string; value: string }[]) =>
    api.put<SalonSettings>('/settings', { settings }, token),

  updateOne: (token: string, key: string, value: string) =>
    api.put<Record<string, unknown>>(`/settings/${key}`, { value }, token),
};
