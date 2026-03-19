import Link from 'next/link';

export const metadata = {
  title: 'الشروط والأحكام — SERVIX',
  description: 'شروط وأحكام استخدام منصة SERVIX',
};

export default function TermsPage(): React.ReactElement {
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
        <h1 className="text-3xl font-bold">الشروط والأحكام</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">آخر تحديث: مارس 2026</p>

        <div className="mt-12 space-y-8 text-[var(--foreground)]">
          <section>
            <h2 className="text-xl font-semibold">1. وصف الخدمة</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              SERVIX منصة SaaS لإدارة الأعمال الخدمية، وتبدأ بصالونات التجميل النسائية في المملكة العربية السعودية.
              توفر المنصة إدارة المواعيد، الفواتير، العملاء، الموظفات، والتقارير.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. التسعير والفوترة</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              الاشتراكات شهرية أو سنوية. الأسعار بالريال السعودي (SAR). يتم تجديد الاشتراك تلقائياً ما لم يتم الإلغاء.
              سياسة الاسترداد: لا استرداد للمبالغ المدفوعة عن الفترة الحالية.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. الإلغاء والاسترداد</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              يمكنك إلغاء اشتراكك في أي وقت. عند الإلغاء، تبقى الخدمة متاحة حتى نهاية الفترة المدفوعة.
              لا نقدم استرداداً للمبالغ المدفوعة مسبقاً.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. ملكية البيانات</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              أنت تملكين كامل بيانات صالونك. نحن نعمل كمعالج للبيانات فقط. يمكنك تصدير بياناتك أو حذف حسابك في أي وقت.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. مستوى الخدمة</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              نهدف إلى توفر 99.9% من الخدمة. قد نحدد أوقات صيانة مبرمجة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. تحديد المسؤولية</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              SERVIX لا تتحمل مسؤولية الخسائر غير المباشرة أو التبعية. المسؤولية محدودة بمبلغ الاشتراك المدفوع خلال آخر 12 شهراً.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. القانون الحاكم</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              تخضع هذه الشروط لقوانين المملكة العربية السعودية. النسخة العربية هي المعتمدة في حالة النزاع.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
