/**
 * Server-side fetcher for the platform's public legal/merchant data.
 * Backed by GET /compliance/legal-info on the API.
 *
 * IMPORTANT: any field that the operator hasn't configured comes back as an
 * empty string. UI consumers MUST hide such fields rather than fall back to
 * placeholder data — we do not display fake commercial registration, VAT,
 * phone, or address information.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface LegalInfo {
  merchant: {
    nameAr: string;
    nameEn: string;
    crNumber: string;
    vatNumber: string;
    city: string;
    country: string;
    address: string;
    mapsUrl: string;
  };
  support: {
    email: string;
    phone: string;
    whatsapp: string;
    hours: string;
  };
  complaints: {
    responseTimeAr: string;
    resolutionTimeAr: string;
  };
  legal: {
    termsUrl: string;
    privacyUrl: string;
    refundUrl: string;
  };
  social: {
    x: string;
    instagram: string;
    tiktok: string;
    snapchat: string;
    facebook: string;
    linkedin: string;
  };
  service: {
    deliveryTimeAr: string;
    paymentMethodsAr: string;
  };
}

const EMPTY: LegalInfo = {
  merchant: {
    nameAr: 'سيرفكس',
    nameEn: 'SERVIX',
    crNumber: '',
    vatNumber: '',
    city: '',
    country: 'المملكة العربية السعودية',
    address: '',
    mapsUrl: '',
  },
  support: { email: '', phone: '', whatsapp: '', hours: '' },
  complaints: { responseTimeAr: '', resolutionTimeAr: '' },
  legal: { termsUrl: '', privacyUrl: '', refundUrl: '' },
  social: { x: '', instagram: '', tiktok: '', snapchat: '', facebook: '', linkedin: '' },
  service: {
    deliveryTimeAr: 'تفعيل فوري بعد تأكيد الاشتراك — لا يوجد توصيل مادي.',
    paymentMethodsAr: '',
  },
};

export async function fetchLegalInfo(): Promise<LegalInfo> {
  try {
    const res = await fetch(`${API_URL}/compliance/legal-info`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return EMPTY;
    const json = await res.json();
    const data = (json?.data ?? json) as Partial<LegalInfo>;
    return {
      merchant: { ...EMPTY.merchant, ...(data.merchant ?? {}) },
      support: { ...EMPTY.support, ...(data.support ?? {}) },
      complaints: { ...EMPTY.complaints, ...(data.complaints ?? {}) },
      legal: { ...EMPTY.legal, ...(data.legal ?? {}) },
      social: { ...EMPTY.social, ...(data.social ?? {}) },
      service: { ...EMPTY.service, ...(data.service ?? {}) },
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Build a list of usable social channel links — empty array if none set.
 * Auto-detects whether each value is already a full URL or a handle/username.
 */
export interface SocialChannel {
  key: 'x' | 'instagram' | 'tiktok' | 'snapchat' | 'facebook' | 'linkedin';
  label: string;
  url: string;
}

export function buildSocialChannels(social: LegalInfo['social']): SocialChannel[] {
  const channels: SocialChannel[] = [];
  const stripAt = (s: string) => s.replace(/^@/, '').trim();
  const isUrl = (s: string) => /^https?:\/\//i.test(s);
  const handle = (raw: string, base: string): string =>
    isUrl(raw) ? raw : `${base}${stripAt(raw)}`;

  if (hasValue(social.x))
    channels.push({ key: 'x', label: 'X (تويتر)', url: handle(social.x, 'https://x.com/') });
  if (hasValue(social.instagram))
    channels.push({ key: 'instagram', label: 'إنستقرام', url: handle(social.instagram, 'https://instagram.com/') });
  if (hasValue(social.tiktok))
    channels.push({ key: 'tiktok', label: 'تيك توك', url: handle(social.tiktok, 'https://www.tiktok.com/@') });
  if (hasValue(social.snapchat))
    channels.push({ key: 'snapchat', label: 'سناب شات', url: handle(social.snapchat, 'https://www.snapchat.com/add/') });
  if (hasValue(social.facebook))
    channels.push({ key: 'facebook', label: 'فيسبوك', url: handle(social.facebook, 'https://facebook.com/') });
  if (hasValue(social.linkedin))
    channels.push({ key: 'linkedin', label: 'لينكدإن', url: handle(social.linkedin, 'https://linkedin.com/company/') });
  return channels;
}

export function hasValue(v: string | undefined | null): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function formatPhoneLink(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}
