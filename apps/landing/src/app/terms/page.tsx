import Link from 'next/link';

export const metadata = {
  title: 'الشروط والأحكام — SERVIX',
  description: 'شروط وأحكام استخدام منصة SERVIX',
};

export default function TermsPage(): React.ReactElement {
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
              <span className="text-xs font-black text-white">SX</span>
            </div>
            <span className="text-lg font-black text-white">SERVIX</span>
          </Link>
          <Link href="/" className="text-sm text-white/50 hover:text-white transition-colors">
            العودة للرئيسية
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-black text-white">الشروط والأحكام</h1>
        <p className="mt-2 text-white/40">آخر تحديث: مارس 2026</p>

        <div className="mt-12 space-y-8">
          {[
            { num: '1', title: 'وصف الخدمة', body: 'SERVIX منصة SaaS لإدارة الأعمال الخدمية، وتبدأ بصالونات التجميل النسائية في المملكة العربية السعودية. توفر المنصة إدارة المواعيد، الفواتير، العملاء، الموظفات، والتقارير.' },
            { num: '2', title: 'التسعير والفوترة', body: 'الاشتراكات شهرية أو سنوية. الأسعار بالريال السعودي (SAR). يتم تجديد الاشتراك تلقائياً ما لم يتم الإلغاء. سياسة الاسترداد: لا استرداد للمبالغ المدفوعة عن الفترة الحالية.' },
            { num: '3', title: 'الإلغاء والاسترداد', body: 'يمكنك إلغاء اشتراكك في أي وقت. عند الإلغاء، تبقى الخدمة متاحة حتى نهاية الفترة المدفوعة. لا نقدم استرداداً للمبالغ المدفوعة مسبقاً.' },
            { num: '4', title: 'ملكية البيانات', body: 'أنت تملكين كامل بيانات صالونك. نحن نعمل كمعالج للبيانات فقط. يمكنك تصدير بياناتك أو حذف حسابك في أي وقت.' },
            { num: '5', title: 'مستوى الخدمة', body: 'نهدف إلى توفر 99.9% من الخدمة. قد نحدد أوقات صيانة مبرمجة.' },
            { num: '6', title: 'تحديد المسؤولية', body: 'SERVIX لا تتحمل مسؤولية الخسائر غير المباشرة أو التبعية. المسؤولية محدودة بمبلغ الاشتراك المدفوع خلال آخر 12 شهراً.' },
            { num: '7', title: 'القانون الحاكم', body: 'تخضع هذه الشروط لقوانين المملكة العربية السعودية. النسخة العربية هي المعتمدة في حالة النزاع.' },
          ].map((s) => (
            <section key={s.num} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white">{s.num}. {s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
