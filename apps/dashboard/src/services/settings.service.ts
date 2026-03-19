import { api } from '@/lib/api';

export type SalonSettings = Record<string, string>;

export const settingsService = {
  getAll: (token: string) =>
    api.get<SalonSettings>('/settings', token),

  updateBatch: (token: string, settings: { key: string; value: string }[]) =>
    api.put<SalonSettings>('/settings', { settings }, token),

  updateOne: (token: string, key: string, value: string) =>
    api.put<Record<string, unknown>>(`/settings/${key}`, { value }, token),
};
