import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchLegalInfo, hasValue } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'سياسة الإلغاء والاسترداد — SERVIX',
  description: 'سياسة إلغاء الاشتراكات والاسترداد لمنصة SERVIX وفق متطلبات وزارة التجارة السعودية.',
};

export const revalidate = 300;

export default async function RefundPolicyPage() {
  const info = await fetchLegalInfo();
  const supportEmail = hasValue(info.support.email) ? info.support.email : null;

  const sections: { num: string; title: string; body: string }[] = [
    {
      num: '1',
      title: 'نطاق هذه السياسة',
      body: 'تنطبق هذه السياسة على اشتراكات منصة سيرفكس (SERVIX) المقدمة كخدمة برمجية (SaaS) لإدارة الصالونات والأعمال الخدمية. لا تتعلق ببيع منتجات مادية، بل باشتراكات شهرية أو سنوية في خدمة رقمية مستمرة.',
    },
    {
      num: '2',
      title: 'وقت التفعيل وتسليم الخدمة',
      body: hasValue(info.service.deliveryTimeAr)
        ? `${info.service.deliveryTimeAr} منصة سيرفكس خدمة رقمية بالكامل (SaaS) — لا يوجد شحن أو توصيل مادي. عند الاشتراك في باقة مدفوعة، تنشّط الباقة فور تأكيد الاشتراك ويظهر وصف التفعيل وتاريخه في الإيصال الإلكتروني.`
        : 'تفعيل فوري بعد تأكيد الاشتراك — لا يوجد توصيل مادي. منصة سيرفكس خدمة رقمية بالكامل (SaaS).',
    },
    {
      num: '3',
      title: 'إلغاء الاشتراك',
      body: 'يمكنك إلغاء اشتراكك في أي وقت من لوحة الإدارة أو بالتواصل مع الدعم. عند الإلغاء، يتوقف التجديد التلقائي وتبقى الخدمة فعّالة حتى نهاية فترة الاشتراك المدفوعة. لا يتم سحب أي رسوم إضافية بعد الإلغاء.',
    },
    {
      num: '4',
      title: 'التجديد التلقائي',
      body: 'الاشتراكات المدفوعة تجدد تلقائيًا في نهاية كل دورة (شهر أو سنة) بنفس الباقة وبالسعر المعلن وقت التجديد، ما لم يتم الإلغاء قبل تاريخ التجديد. يحق لك إيقاف التجديد التلقائي في أي وقت من لوحة الإعدادات.',
    },
    {
      num: '5',
      title: 'الفترة التجريبية',
      body: 'عند توفر فترة تجريبية مجانية، لا تُحتسب أي رسوم خلالها. يمكنك إنهاء التجربة قبل انتهائها دون أي التزام مالي. عند الانتقال إلى اشتراك مدفوع، تنطبق سياسة التجديد التلقائي المذكورة أعلاه.',
    },
    {
      num: '6',
      title: 'متى يمكن طلب الاسترداد',
      body: 'يحق لك طلب استرداد المبلغ كاملاً خلال 14 يومًا من تاريخ أول دفعة لاشتراك جديد، إذا لم تكن قد استخدمت الخدمة استخدامًا فعليًا (إنشاء حجوزات، إصدار فواتير، إرسال رسائل واتساب). يتم تقييم كل طلب على حدة ويُرد المبلغ بنفس وسيلة الدفع خلال 7 إلى 14 يوم عمل بعد الموافقة.',
    },
    {
      num: '7',
      title: 'الحالات المستثناة من الاسترداد',
      body: 'لا يحق طلب الاسترداد في الحالات التالية: (أ) الاشتراكات السنوية بعد مرور 14 يومًا من بدء الاشتراك. (ب) المبالغ المتعلقة بفترات استخدام منقضية. (ج) الاشتراكات التي تم إلغاؤها من الإدارة بسبب مخالفة الشروط والأحكام. (د) الإضافات (Add-ons) أو الميزات المخصصة التي تم تفعيلها وبدأ استهلاكها.',
    },
    {
      num: '8',
      title: 'طريقة طلب الاسترداد أو الإلغاء',
      body: supportEmail
        ? `للإلغاء أو طلب الاسترداد، أرسل/ي رسالة إلى ${supportEmail} موضحًا اسم المنشأة ورقم الاشتراك وسبب الطلب. أو استخدم/ي صفحة الشكاوى على الموقع لتسجيل الطلب برقم مرجعي يمكن متابعته.`
        : 'استخدم/ي صفحة الشكاوى على الموقع لتقديم الطلب برقم مرجعي يمكن متابعته. سيتم التواصل معك عبر القناة المسجلة للرد على الطلب.',
    },
    {
      num: '9',
      title: 'مدة معالجة الطلب',
      body: hasValue(info.complaints.responseTimeAr) || hasValue(info.complaints.resolutionTimeAr)
        ? `${hasValue(info.complaints.responseTimeAr) ? `الرد المبدئي: ${info.complaints.responseTimeAr}. ` : ''}${hasValue(info.complaints.resolutionTimeAr) ? `معالجة الطلب: ${info.complaints.resolutionTimeAr}.` : ''} في حال الموافقة على الاسترداد، يتم إرجاع المبلغ خلال 7 إلى 14 يوم عمل.`
        : 'يتم الرد على الطلب خلال 24 ساعة عمل، ومعالجته خلال 3 إلى 7 أيام عمل. عند الموافقة على الاسترداد، يتم إرجاع المبلغ خلال 7 إلى 14 يوم عمل بنفس وسيلة الدفع.',
    },
    {
      num: '10',
      title: 'بيانات الفاتورة بعد الإلغاء',
      body: 'يمكنك تصدير فواتيرك ومحفوظاتك من لوحة الإدارة في أي وقت قبل أو بعد الإلغاء. يتم الاحتفاظ ببيانات الفواتير وفقًا للمتطلبات النظامية السعودية. للمزيد راجع/ي سياسة الخصوصية.',
    },
    {
      num: '11',
      title: 'تعديل هذه السياسة',
      body: 'يحق لـ سيرفكس تعديل هذه السياسة لأسباب نظامية أو تشغيلية. يتم إخطار المشتركين بالتعديلات الجوهرية عبر البريد الإلكتروني أو لوحة الإدارة قبل سريانها بمدة كافية.',
    },
  ];

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

      <main className="mx-auto max-w-4xl px-4 py-16" dir="rtl">
        <h1 className="text-3xl font-black text-white">سياسة الإلغاء والاسترداد</h1>
        <p className="mt-2 text-white/40">آخر تحديث: أبريل 2026</p>

        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 text-sm leading-relaxed text-amber-100/80">
          هذه السياسة جزء من الشروط والأحكام. الخدمة المقدمة هي اشتراك في منصة SaaS رقمية،
          وليست بيع منتج مادي. يرجى قراءتها بعناية قبل الاشتراك.
        </div>

        <div className="mt-10 space-y-4">
          {sections.map((s) => (
            <section key={s.num} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white">{s.num}. {s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.07] p-5 text-sm text-white/50">
          روابط ذات صلة:{' '}
          <Link href="/terms" className="text-violet-300 hover:text-violet-200">الشروط والأحكام</Link>
          {' · '}
          <Link href="/privacy" className="text-violet-300 hover:text-violet-200">سياسة الخصوصية</Link>
          {' · '}
          <Link href="/complaints" className="text-violet-300 hover:text-violet-200">تقديم شكوى</Link>
        </div>
      </main>
    </div>
  );
}
