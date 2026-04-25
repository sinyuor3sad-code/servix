import { z } from 'zod';

const booleanSchema = z.enum(['true', 'false'], {
  errorMap: () => ({ message: 'القيمة يجب أن تكون true أو false' }),
});

const intRangeSchema = (min: number, max: number, message: string) =>
  z.string().refine(
    (v) => {
      const n = parseInt(v, 10);
      return Number.isInteger(n) && String(n) === v.trim() && n >= min && n <= max;
    },
    message,
  );

// ── Time format HH:mm ──
const optionalUrlSchema = z.string().max(500, 'الرابط طويل جداً').refine(
  (v) => {
    const value = v.trim();
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  },
  'الرابط يجب أن يكون URL صالحاً يبدأ بـ http أو https',
);

const timeSchema = z.string().regex(
  /^([01]\d|2[0-3]):([0-5]\d)$/,
  'صيغة الوقت غير صحيحة — يجب أن تكون HH:mm',
);

// ── Known settings key-value validators ──
const SETTINGS_VALIDATORS: Record<string, z.ZodType<string>> = {
  // Working hours
  'workingHours.start': timeSchema,
  'workingHours.end': timeSchema,

  // Slot
  slotDuration: z.string().refine(
    (v) => { const n = parseInt(v, 10); return !isNaN(n) && n >= 5 && n <= 480; },
    'مدة الموعد يجب أن تكون بين 5 و 480 دقيقة',
  ),
  slotBuffer: z.string().refine(
    (v) => { const n = parseInt(v, 10); return !isNaN(n) && n >= 0 && n <= 60; },
    'الفاصل الزمني يجب أن يكون بين 0 و 60 دقيقة',
  ),

  // Currency
  currency: z.enum(['SAR', 'AED', 'KWD', 'BHD', 'OMR', 'QAR'], {
    errorMap: () => ({ message: 'العملة غير مدعومة' }),
  }),

  // Tax
  taxRate: z.string().refine(
    (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 100; },
    'نسبة الضريبة يجب أن تكون بين 0 و 100',
  ),

  // Boolean flags
  vacationMode: z.enum(['true', 'false'], {
    errorMap: () => ({ message: 'القيمة يجب أن تكون true أو false' }),
  }),
  smsEnabled: booleanSchema,
  whatsappEnabled: booleanSchema,
  loyaltyEnabled: booleanSchema,
  inventoryEnabled: booleanSchema,

  whatsapp_enabled: booleanSchema,
  whatsapp_booking_confirm: booleanSchema,
  whatsapp_booking_reminder: booleanSchema,
  whatsapp_invoice_send: booleanSchema,
  whatsapp_review_request: booleanSchema,
  whatsapp_marketing_enabled: booleanSchema,
  whatsapp_business_hours_enabled: booleanSchema,
  whatsapp_rate_limit_per_hour: intRangeSchema(1, 200, 'حد واتساب يجب أن يكون بين 1 و 200 رسالة في الساعة'),
  whatsapp_random_delay_min_ms: intRangeSchema(500, 60000, 'أقل تأخير يجب أن يكون بين 500 و 60000 مللي ثانية'),
  whatsapp_random_delay_max_ms: intRangeSchema(500, 120000, 'أقصى تأخير يجب أن يكون بين 500 و 120000 مللي ثانية'),

  ai_reception_enabled: booleanSchema,
  ai_tone: z.enum(['formal', 'friendly', 'light_gulf', 'luxury'], {
    errorMap: () => ({ message: 'النبرة يجب أن تكون formal أو friendly أو light_gulf أو luxury' }),
  }),
  ai_welcome_message: z.string().max(500, 'رسالة الترحيب طويلة جداً'),
  ai_approval_timeout_minutes: intRangeSchema(1, 120, 'مهلة موافقة الصالون يجب أن تكون بين 1 و 120 دقيقة'),
  ai_max_understanding_failures: intRangeSchema(1, 5, 'عدد محاولات الفهم يجب أن يكون بين 1 و 5'),
  ai_escalation_cooldown_minutes: intRangeSchema(1, 120, 'تهدئة التصعيد يجب أن تكون بين 1 و 120 دقيقة'),
  ai_booking_confirmation_mode: z.enum(['manual', 'auto_if_available'], {
    errorMap: () => ({ message: 'وضع تأكيد الحجز يجب أن يكون manual أو auto_if_available' }),
  }),
  ai_privacy_message_enabled: booleanSchema,
  ai_privacy_message: z.string().max(500, 'رسالة الخصوصية طويلة جداً'),
  ai_avoided_phrases: z.string().max(1000, 'قائمة الكلمات غير المرغوبة طويلة جداً'),
  ai_custom_escalation_keywords: z.string().max(1000, 'قائمة كلمات التصعيد طويلة جداً'),
  ai_show_employee_names_to_customers: booleanSchema,
  ai_available_slots_limit: intRangeSchema(1, 5, 'عدد الأوقات المعروضة يجب أن يكون بين 1 و 5'),

  review_request_enabled: booleanSchema,
  review_request_delay_minutes: intRangeSchema(0, 1440, 'مهلة طلب التقييم يجب أن تكون بين 0 و 1440 دقيقة'),
  google_review_url: optionalUrlSchema,
  low_rating_threshold: intRangeSchema(1, 4, 'حد التقييم المنخفض يجب أن يكون بين 1 و 4'),
  high_rating_threshold: intRangeSchema(2, 5, 'حد التقييم العالي يجب أن يكون بين 2 و 5'),
  review_request_message: z.string().max(500, 'رسالة طلب التقييم طويلة جداً'),
  low_rating_response_message: z.string().max(500, 'رسالة التقييم المنخفض طويلة جداً'),
  high_rating_response_message: z.string().max(700, 'رسالة التقييم العالي طويلة جداً'),

  // Salon name
  'salon.nameAr': z.string().min(2, 'اسم الصالون يجب أن يكون حرفين على الأقل').max(100, 'اسم الصالون طويل جداً'),
  'salon.nameEn': z.string().max(100, 'اسم الصالون طويل جداً'),

  // Days off (JSON array of 0-6)
  daysOff: z.string().refine(
    (v) => {
      try {
        const arr = JSON.parse(v);
        return Array.isArray(arr) && arr.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);
      } catch { return false; }
    },
    'أيام الإجازة يجب أن تكون مصفوفة أرقام من 0 إلى 6',
  ),
};

/**
 * Validate a single setting key-value pair.
 * Returns null if valid, or an error message string if invalid.
 * Unknown keys are passed through without validation.
 */
export function validateSetting(key: string, value: string): string | null {
  const validator = SETTINGS_VALIDATORS[key];
  if (!validator) return null; // Unknown keys pass through

  const result = validator.safeParse(value);
  if (result.success) return null;

  return result.error.errors[0]?.message || 'قيمة غير صحيحة';
}

/**
 * Validate a batch of settings.
 * Returns a map of key → error message for invalid entries.
 * Returns empty object if all valid.
 */
export function validateSettingsBatch(
  settings: Array<{ key: string; value: string }>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { key, value } of settings) {
    const error = validateSetting(key, value);
    if (error) errors[key] = error;
  }
  return errors;
}
