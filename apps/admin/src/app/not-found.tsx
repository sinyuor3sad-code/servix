import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#06060a' }} dir="rtl">
      <div className="text-center px-4">
        <p className="text-8xl font-extrabold text-amber-400/15">404</p>
        <h1 className="mt-4 text-2xl font-bold text-white/80">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-white/30">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-sm font-bold text-black transition-all hover:shadow-lg hover:shadow-amber-500/20"
        >
          لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
