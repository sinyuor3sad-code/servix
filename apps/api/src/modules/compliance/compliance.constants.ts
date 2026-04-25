/**
 * Platform compliance settings (Saudi MoC e-commerce trust criteria).
 * Stored as key/value rows in platform_settings; read via PlatformSettingsService.
 *
 * IMPORTANT: defaults intentionally leave commercial registration / VAT empty.
 * No fake numbers — operators must populate them from the admin panel.
 */
export const COMPLIANCE_KEYS = {
  // Merchant identity
  merchant_name_ar: 'merchant_name_ar',
  merchant_name_en: 'merchant_name_en',
  merchant_cr_number: 'merchant_cr_number',
  merchant_vat_number: 'merchant_vat_number',
  merchant_city: 'merchant_city',
  merchant_country: 'merchant_country',
  merchant_address: 'merchant_address',
  merchant_maps_url: 'merchant_maps_url',

  // Contact channels
  support_email: 'support_email',
  support_phone: 'support_phone',
  support_whatsapp: 'support_whatsapp',
  support_hours: 'support_hours',

  // Complaint policy disclosures
  complaint_response_time_ar: 'complaint_response_time_ar',
  complaint_resolution_time_ar: 'complaint_resolution_time_ar',

  // Legal page links (allow override; defaults render the built-in pages)
  legal_terms_url: 'legal_terms_url',
  legal_privacy_url: 'legal_privacy_url',
  legal_refund_url: 'legal_refund_url',

  // Social media handles — required by MoC criterion 6
  // (consumers must be able to reach support / file complaints via social).
  social_x: 'social_x',
  social_instagram: 'social_instagram',
  social_tiktok: 'social_tiktok',
  social_snapchat: 'social_snapchat',
  social_facebook: 'social_facebook',
  social_linkedin: 'social_linkedin',

  // Service delivery / activation time — MoC criterion 9
  // (must be disclosed before purchase and on the invoice/receipt).
  service_delivery_time_ar: 'service_delivery_time_ar',
  payment_methods_ar: 'payment_methods_ar',
} as const;

/**
 * Defaults are intentionally EMPTY for any regulated identifier (CR, VAT,
 * phone, full address). The UI must hide such fields when empty rather than
 * display a placeholder — never show fake business data to users.
 *
 * Free-text generic fields (merchant name, country, support hours, complaint
 * SLAs) carry safe non-identifying defaults.
 */
export const COMPLIANCE_DEFAULTS: Record<string, string> = {
  [COMPLIANCE_KEYS.merchant_name_ar]: 'سيرفكس',
  [COMPLIANCE_KEYS.merchant_name_en]: 'SERVIX',
  [COMPLIANCE_KEYS.merchant_cr_number]: '',
  [COMPLIANCE_KEYS.merchant_vat_number]: '',
  [COMPLIANCE_KEYS.merchant_city]: '',
  [COMPLIANCE_KEYS.merchant_country]: 'المملكة العربية السعودية',
  [COMPLIANCE_KEYS.merchant_address]: '',
  [COMPLIANCE_KEYS.merchant_maps_url]: '',
  [COMPLIANCE_KEYS.support_email]: '',
  [COMPLIANCE_KEYS.support_phone]: '',
  [COMPLIANCE_KEYS.support_whatsapp]: '',
  [COMPLIANCE_KEYS.support_hours]: 'الأحد - الخميس، 9 ص - 6 م',
  [COMPLIANCE_KEYS.complaint_response_time_ar]: 'خلال 24 ساعة عمل',
  [COMPLIANCE_KEYS.complaint_resolution_time_ar]: 'من 3 إلى 7 أيام عمل حسب نوع الشكوى',
  [COMPLIANCE_KEYS.legal_terms_url]: '',
  [COMPLIANCE_KEYS.legal_privacy_url]: '',
  [COMPLIANCE_KEYS.legal_refund_url]: '',

  // Social handles intentionally empty — never display fake handles.
  [COMPLIANCE_KEYS.social_x]: '',
  [COMPLIANCE_KEYS.social_instagram]: '',
  [COMPLIANCE_KEYS.social_tiktok]: '',
  [COMPLIANCE_KEYS.social_snapchat]: '',
  [COMPLIANCE_KEYS.social_facebook]: '',
  [COMPLIANCE_KEYS.social_linkedin]: '',

  // SaaS-truthful default: digital service, instant activation. Always true.
  [COMPLIANCE_KEYS.service_delivery_time_ar]:
    'تفعيل فوري بعد تأكيد الاشتراك — لا يوجد توصيل مادي. متوسط زمن التفعيل أقل من دقيقتين.',

  // INTENTIONALLY EMPTY: payment-method text must reflect a real, wired
  // gateway. The operator fills this only after the payment integration is
  // live in production. Showing a default like "Mada via SAMA-licensed
  // gateway" while no gateway is hooked up would be a misleading claim.
  [COMPLIANCE_KEYS.payment_methods_ar]: '',
};

export const COMPLAINT_TYPES_AR = [
  'مشكلة في الفوترة أو الدفع',
  'مشكلة في الاشتراك',
  'مشكلة فنية',
  'استفسار عام',
  'شكوى بخصوص الخدمة',
  'طلب استرداد',
  'أخرى',
] as const;
