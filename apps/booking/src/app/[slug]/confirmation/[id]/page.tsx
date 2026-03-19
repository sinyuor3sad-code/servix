import { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Phone,
  Scissors,
  ArrowRight,
  Share2,
} from 'lucide-react';
import { bookingApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let salonName = 'SERVIX';
  try {
    const salon = await bookingApi.getSalonInfo(slug);
    salonName = salon.nameAr;
  } catch {
    /* fallback */
  }
  return {
    title: `تم تأكيد الحجز — ${salonName}`,
    description: 'تم تأكيد حجزك بنجاح. سيتم التواصل معك قريباً.',
  };
}

const DAY_NAMES: Record<string, string> = {
  '0': 'الأحد',
  '1': 'الاثنين',
  '2': 'الثلاثاء',
  '3': 'الأربعاء',
  '4': 'الخميس',
  '5': 'الجمعة',
  '6': 'السبت',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = DAY_NAMES[date.getDay().toString()] ?? '';
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${day} ${d}/${m}/${y}`;
}

export default async function ConfirmationPage({ params }: PageProps): Promise<React.ReactElement> {
  const { slug, id } = await params;

  let salon;
  try {
    salon = await bookingApi.getSalonInfo(slug);
  } catch {
    salon = null;
  }

  const salonName = salon?.nameAr ?? 'الصالون';
  const salonPhone = salon?.phone;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-start justify-center p-4 pt-12 sm:pt-20">
      <div className="w-full max-w-lg">
        {/* Success Icon */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">
            تم تأكيد حجزك بنجاح!
          </h1>
          <p className="text-gray-600">
            رقم الحجز: <span className="font-mono font-bold text-gray-800">{id.slice(0, 8).toUpperCase()}</span>
          </p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
          <div
            className="px-6 py-4"
            style={{ backgroundColor: salon?.primaryColor ?? '#8b5cf6' }}
          >
            <h2 className="text-white font-bold text-lg">{salonName}</h2>
            <p className="text-white/80 text-sm">تفاصيل الحجز</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Booking ID */}
            <InfoRow
              icon={<Calendar className="w-5 h-5" />}
              label="رقم الحجز"
              value={id.slice(0, 8).toUpperCase()}
            />

            {/* Status */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">الحالة</p>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  في انتظار التأكيد
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* What's Next Card */}
        <div className="bg-blue-50 rounded-2xl p-6 mb-6 border border-blue-100">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            ماذا بعد؟
          </h3>
          <ul className="space-y-3 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                1
              </span>
              <span>سيقوم الصالون بمراجعة حجزك وتأكيده</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                2
              </span>
              <span>ستصلك رسالة تأكيد على رقم جوالك</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                3
              </span>
              <span>يرجى الحضور قبل الموعد بـ 5 دقائق</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {salonPhone && (
            <a
              href={`tel:${salonPhone}`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              <Phone className="w-5 h-5" />
              اتصل بالصالون
            </a>
          )}

          <button
            type="button"
            onClick={undefined}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-5 h-5" />
            مشاركة تفاصيل الحجز
          </button>

          <Link
            href={`/${slug}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-gray-500 font-medium hover:text-gray-700 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
            العودة لصفحة الصالون
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-10 pb-8">
          <p className="text-xs text-gray-400">
            مدعوم بواسطة{' '}
            <span className="font-bold text-gray-500">SERVIX</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 text-gray-500">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}
