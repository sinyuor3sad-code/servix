import { api } from '@/lib/api';

export type SalonSettings = Record<string, string>;

const DEV_SETTINGS: SalonSettings = {
  onboarding_completed: 'true',
  dashboard_theme: 'velvet',
  dashboard_mode: 'light',
  online_booking_enabled: 'true',
  whatsapp_enabled: 'false',
  ai_reception_enabled: 'true',
  ai_tone: 'light_gulf',
  ai_approval_timeout_minutes: '15',
  ai_max_understanding_failures: '2',
  ai_escalation_cooldown_minutes: '10',
  ai_available_slots_limit: '3',
  ai_booking_confirmation_mode: 'manual',
  ai_privacy_message_enabled: 'false',
  review_request_enabled: 'false',
  review_request_delay_minutes: '60',
  google_review_url: '',
  low_rating_threshold: '3',
  high_rating_threshold: '4',
  review_request_message: 'نسعد بمعرفة تقييمك لتجربتك من 1 إلى 5.',
  low_rating_response_message: 'نعتذر عن تجربتك. تم رفع ملاحظتك للإدارة لتحسين الخدمة.',
  high_rating_response_message: 'شكرًا لتقييمك. يسعدنا دعمك بتقييمنا على Google: [googleReviewUrl]',
  vacation_mode: 'false',
  seasonal_themes_enabled: 'true',
};

export const settingsService = {
  getAll: (token: string) => {
    if (token?.startsWith('dev-access-token-')) {
      return Promise.resolve(DEV_SETTINGS);
    }
    return api.get<SalonSettings>('/settings', token);
  },

  updateBatch: (token: string, settings: { key: string; value: string }[]) =>
    api.put<SalonSettings>('/settings', { settings }, token),

  updateOne: (token: string, key: string, value: string) =>
    api.put<Record<string, unknown>>(`/settings/${key}`, { value }, token),
};
