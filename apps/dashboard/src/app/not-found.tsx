import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center px-4">
        <p className="text-8xl font-extrabold text-brand-primary/20">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
