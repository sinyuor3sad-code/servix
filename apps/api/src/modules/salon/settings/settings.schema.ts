import { z } from 'zod';

// ── Time format HH:mm ──
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
  smsEnabled: z.enum(['true', 'false'], {
    errorMap: () => ({ message: 'القيمة يجب أن تكون true أو false' }),
  }),
  whatsappEnabled: z.enum(['true', 'false'], {
    errorMap: () => ({ message: 'القيمة يجب أن تكون true أو false' }),
  }),
  loyaltyEnabled: z.enum(['true', 'false'], {
    errorMap: () => ({ message: 'القيمة يجب أن تكون true أو false' }),
  }),
  inventoryEnabled: z.enum(['true', 'false'], {
    errorMap: () => ({ message: 'القيمة يجب أن تكون true أو false' }),
  }),

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
