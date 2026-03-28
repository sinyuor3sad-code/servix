/**
 * Mock Salon Info — GET /api/v1/booking/[slug]
 *
 * Returns realistic test data so the booking page renders
 * without a running backend. Different slugs return different
 * color schemes for visual testing.
 *
 * Usage:  http://localhost:3001/demo
 *         http://localhost:3001/pink
 *         http://localhost:3001/dark
 */
import { NextRequest, NextResponse } from 'next/server';

interface SlugPreset {
  primaryColor: string;
  secondaryColor: string;
  nameAr: string;
}

const SLUG_PRESETS: Record<string, SlugPreset> = {
  demo:   { primaryColor: '#c9a84c', secondaryColor: '#e8c97d', nameAr: 'صالون الأناقة الملكية' },
  pink:   { primaryColor: '#ec4899', secondaryColor: '#f9a8d4', nameAr: 'صالون بينك بيوتي' },
  dark:   { primaryColor: '#18181b', secondaryColor: '#d4af37', nameAr: 'صالون نوار VIP' },
  green:  { primaryColor: '#059669', secondaryColor: '#6ee7b7', nameAr: 'صالون أوركيد' },
  purple: { primaryColor: '#7c3aed', secondaryColor: '#c084fc', nameAr: 'صالون مخملي' },
};

const DEFAULT_PRESET: SlugPreset = {
  primaryColor: '#a855f7',
  secondaryColor: '#06b6d4',
  nameAr: 'صالون سيرفكس',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const preset = SLUG_PRESETS[slug] ?? DEFAULT_PRESET;

  const salon = {
    id:             'mock-salon-id',
    nameAr:         preset.nameAr,
    nameEn:         'SERVIX Salon',
    descriptionAr:  'وجهتك الأولى للجمال والاسترخاء في قلب الرياض — خدمات احترافية بلمسة راقية.',
    descriptionEn:  'Your premier beauty destination in the heart of Riyadh.',
    phone:          '+966 50 123 4567',
    email:          'info@salon.sa',
    address:        'حي النزهة، طريق الملك فهد',
    city:           'الرياض',
    logoUrl:        null,
    coverUrl:       null,
    primaryColor:   preset.primaryColor,
    secondaryColor: preset.secondaryColor,
    workingDays: {
      saturday:  { open: true,  start: '09:00:00', end: '22:00:00' },
      sunday:    { open: true,  start: '09:00:00', end: '22:00:00' },
      monday:    { open: true,  start: '09:00:00', end: '22:00:00' },
      tuesday:   { open: true,  start: '09:00:00', end: '22:00:00' },
      wednesday: { open: true,  start: '09:00:00', end: '22:00:00' },
      thursday:  { open: true,  start: '09:00:00', end: '23:00:00' },
      friday:    { open: false, start: '14:00:00', end: '23:00:00' },
    },
  };

  return NextResponse.json({ success: true, data: salon });
}
