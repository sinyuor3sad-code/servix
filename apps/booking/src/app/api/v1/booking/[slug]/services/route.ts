/**
 * Mock Services — GET /api/v1/booking/[slug]/services
 * Returns realistic service categories with Arabic content.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  _ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const categories = [
    {
      id:      'cat-hair',
      nameAr:  'العناية بالشعر',
      nameEn:  'Hair Care',
      services: [
        {
          id:            'svc-haircut',
          nameAr:        'قص وتصفيف الشعر',
          nameEn:        'Haircut & Styling',
          price:         120,
          duration:      60,
          descriptionAr: 'قص احترافي مع تصفيف وتجفيف على يد أمهر المتخصصات',
          imageUrl:      null,
        },
        {
          id:            'svc-color',
          nameAr:        'صبغة شعر كاملة',
          nameEn:        'Full Hair Color',
          price:         280,
          duration:      120,
          descriptionAr: 'صبغة عالية الجودة مع ضمان الثبات لأكثر من 6 أسابيع',
          imageUrl:      null,
        },
        {
          id:            'svc-keratin',
          nameAr:        'علاج الكيراتين',
          nameEn:        'Keratin Treatment',
          price:         450,
          duration:      180,
          descriptionAr: 'علاج مكثف يمنح شعرك النعومة والبريق ويقضي على التجعد',
          imageUrl:      null,
        },
      ],
    },
    {
      id:      'cat-skin',
      nameAr:  'العناية بالبشرة',
      nameEn:  'Skin Care',
      services: [
        {
          id:            'svc-facial',
          nameAr:        'جلسة عناية بالوجه',
          nameEn:        'Facial Treatment',
          price:         200,
          duration:      75,
          descriptionAr: 'تنظيف عميق وترطيب مكثف للبشرة مع بخار الأعشاب الطبيعية',
          imageUrl:      null,
        },
        {
          id:            'svc-peeling',
          nameAr:        'تقشير بالليزر',
          nameEn:        'Laser Peeling',
          price:         380,
          duration:      45,
          descriptionAr: 'تقشير متقدم للتخلص من البقع الداكنة وتجديد خلايا البشرة',
          imageUrl:      null,
        },
      ],
    },
    {
      id:      'cat-nails',
      nameAr:  'العناية بالأظافر',
      nameEn:  'Nail Care',
      services: [
        {
          id:            'svc-manicure',
          nameAr:        'مانيكير فرنسي',
          nameEn:        'French Manicure',
          price:         85,
          duration:      45,
          descriptionAr: 'مانيكير كلاسيكي بأحدث التقنيات مع لمعان يدوم طويلاً',
          imageUrl:      null,
        },
        {
          id:            'svc-pedicure',
          nameAr:        'باديكير علاجي',
          nameEn:        'Medical Pedicure',
          price:         110,
          duration:      60,
          descriptionAr: 'عناية متكاملة بالقدمين مع تقشير وترطيب عميق',
          imageUrl:      null,
        },
        {
          id:            'svc-gel',
          nameAr:        'جل مع رسومات',
          nameEn:        'Gel Nail Art',
          price:         150,
          duration:      90,
          descriptionAr: 'طلاء جل ثابت مع تصاميم فنية مميزة حسب الطلب',
          imageUrl:      null,
        },
      ],
    },
  ];

  return NextResponse.json({ success: true, data: categories });
}
