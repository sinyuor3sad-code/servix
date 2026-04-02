import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa]" dir="rtl">
      <div className="text-center px-4">
        <p className="text-8xl font-extrabold text-purple-500/20">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-gray-500">الصالون الذي تبحثين عنه غير موجود أو الرابط غير صحيح.</p>
        <p className="mt-1 text-xs text-gray-400" dir="ltr">
          booking.servi-x.com/<span className="text-purple-400">salon-name</span>
        </p>
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
