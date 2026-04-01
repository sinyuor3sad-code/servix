import Link from 'next/link';

export const metadata = {
  title: 'SERVIX — حجز المواعيد',
  description: 'منصة حجز مواعيد صالونات التجميل في السعودية',
};

export default function BookingHomePage(): React.ReactElement {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0e2e 50%, #0d0820 100%)' }}
      dir="rtl"
    >
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #9333ea, #6366f1)' }}
        >
          S
        </div>
        <h1 className="text-3xl font-bold text-white">SERVIX</h1>
        <p className="mt-3 text-lg text-white/50">
          منصة حجز مواعيد صالونات التجميل
        </p>
        <p className="mt-6 text-sm text-white/35">
          للحجز، استخدمي الرابط المخصص لصالونك
        </p>
        <p className="mt-2 text-xs text-white/25" dir="ltr">
          booking.servi-x.com/<span className="text-violet-400/60">salon-name</span>
        </p>
        <Link
          href="https://servi-x.com"
          className="mt-8 inline-block rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-violet-500"
        >
          تعرّفي على SERVIX
        </Link>
      </div>
    </div>
  );
}
