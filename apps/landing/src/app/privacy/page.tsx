import Link from 'next/link';

export const metadata = {
  title: 'سياسة الخصوصية — SERVIX',
  description: 'سياسة الخصوصية وحماية البيانات في SERVIX',
};

export default function PrivacyPage(): React.ReactElement {
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
        <h1 className="text-3xl font-black text-white">سياسة الخصوصية</h1>
        <p className="mt-2 text-white/40">آخر تحديث: مارس 2026</p>

        <div className="mt-12 space-y-4">
          {[
            { num: '1', title: 'البيانات التي نجمعها', body: 'نجمع بيانات الحساب (الاسم، البريد، الجوال)، بيانات الصالون (الاسم، العنوان، معلومات الاتصال)، بيانات العملاء والموظفات التي تدخلينها، وسجلات الاستخدام. لا نبيع بياناتك لأطراف ثالثة.' },
            { num: '2', title: 'كيفية تخزين البيانات', body: 'كل صالون له قاعدة بيانات منفصلة ومعزولة. البيانات مشفرة في النقل والتخزين. نستخدم بنية تحتية آمنة في المملكة أو المنطقة.' },
            { num: '3', title: 'من له الوصول', body: 'فقط أنت والمستخدمين الذين تضيفينهم لصالونك يمكنهم الوصول لبيانات الصالون. فريق SERVIX يصل للبيانات فقط لدعم فني أو صيانة، وبموافقة أو طلب منك.' },
            { num: '4', title: 'فترة الاحتفاظ', body: 'نحتفظ ببياناتك طالما حسابك نشط. عند حذف الحساب، تُحذف البيانات نهائياً خلال 60 يوماً من انتهاء الاشتراك. يمكنك طلب التصدير أو الحذف في أي وقت.' },
            { num: '5', title: 'الامتثال لـ PDPL السعودية', body: 'نلتزم بنظام حماية البيانات الشخصية السعودي (PDPL). لديك الحق في الوصول، التصحيح، والحذف لبياناتك.' },
            { num: '6', title: 'سياسة الكوكيز', body: 'نستخدم كوكيز أساسية لتشغيل الموقع وحفظ تفضيلاتك. لا نستخدم كوكيز تتبع لأغراض إعلانية.' },
            { num: '7', title: 'التواصل', body: 'لطلبات البيانات أو الاستفسارات: privacy@servi-x.com' },
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
