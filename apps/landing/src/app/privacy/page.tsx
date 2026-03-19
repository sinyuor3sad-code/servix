import Link from 'next/link';

export const metadata = {
  title: 'سياسة الخصوصية — SERVIX',
  description: 'سياسة الخصوصية وحماية البيانات في SERVIX',
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-[var(--brand-primary)]">
            SERVIX
          </Link>
          <Link href="/" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            العودة للرئيسية
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold">سياسة الخصوصية</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">آخر تحديث: مارس 2026</p>

        <div className="mt-12 space-y-8 text-[var(--foreground)]">
          <section>
            <h2 className="text-xl font-semibold">1. البيانات التي نجمعها</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              نجمع بيانات الحساب (الاسم، البريد، الجوال)، بيانات الصالون (الاسم، العنوان، معلومات الاتصال)،
              بيانات العملاء والموظفات التي تدخلينها، وسجلات الاستخدام. لا نبيع بياناتك لأطراف ثالثة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. كيفية تخزين البيانات</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              كل صالون له قاعدة بيانات منفصلة ومعزولة. البيانات مشفرة في النقل والتخزين.
              نستخدم بنية تحتية آمنة في المملكة أو المنطقة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. من له الوصول</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
             فقط أنت والمستخدمين الذين تضيفينهم لصالونك يمكنهم الوصول لبيانات الصالون.
              فريق SERVIX يصل للبيانات فقط لدعم فني أو صيانة، وبموافقة أو طلب منك.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. فترة الاحتفاظ</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              نحتفظ ببياناتك طالما حسابك نشط. عند حذف الحساب، تُحذف البيانات نهائياً خلال 60 يوماً من انتهاء الاشتراك.
              يمكنك طلب التصدير أو الحذف في أي وقت.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. الامتثال لـ PDPL السعودية</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              نلتزم بنظام حماية البيانات الشخصية السعودي (PDPL). لديك الحق في الوصول، التصحيح، والحذف لبياناتك.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. سياسة الكوكيز</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              نستخدم كوكيز أساسية لتشغيل الموقع وحفظ تفضيلاتك. لا نستخدم كوكيز تتبع لأغراض إعلانية.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. التواصل</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              لطلبات البيانات أو الاستفسارات: privacy@servix.com
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
