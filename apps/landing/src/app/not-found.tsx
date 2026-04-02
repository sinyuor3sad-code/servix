import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#03020a' }} dir="rtl">
      <div className="text-center px-4">
        <p className="text-8xl font-extrabold text-purple-500/15">404</p>
        <h1 className="mt-4 text-2xl font-bold text-white/80">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-white/35">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-purple-500"
        >
          الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
