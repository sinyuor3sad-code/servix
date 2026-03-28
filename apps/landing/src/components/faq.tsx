'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    q: 'هل أحتاج بطاقة ائتمان للتجربة المجانية؟',
    a: 'لا. التجربة المجانية 14 يوم لا تتطلب أي بطاقة ائتمان أو معلومات دفع. تستمتعين بكل مميزات الباقة الاحترافية بالكامل.',
  },
  {
    q: 'هل بيانات صالوني آمنة؟',
    a: 'نعم تماماً. كل صالون له قاعدة بيانات منفصلة ومعزولة — لا مشاركة بيانات مع أي صالون آخر. كل البيانات مشفرة ومحفوظة بأعلى معايير الأمان، مع نسخ احتياطية يومية.',
  },
  {
    q: 'كيف أربط حساب واتساب؟',
    a: 'كل صالون يربط رقم واتساب الخاص من إعدادات Meta Business. الرسائل تخرج من رقمك أنت، لا من رقم مشترك. يمكنك إرسال تأكيدات الحجز، التذكيرات، والفواتير مباشرة.',
  },
  {
    q: 'هل المنصة متوافقة مع هيئة الزكاة والضريبة (ZATCA)؟',
    a: 'نعم. فواتير ZATCA متاحة في باقة الاحترافي والمميز. الفواتير تشمل QR كود، ضريبة القيمة المضافة 15%، ورقم ضريبي — متوافقة مع متطلبات الفوترة الإلكترونية.',
  },
  {
    q: 'هل يمكنني استخدام SERVIX على الجوال؟',
    a: 'نعم. المنصة تعمل بشكل ممتاز على الجوال عبر المتصفح. نعمل على تطبيق مخصص سيكون متاحاً قريباً.',
  },
  {
    q: 'ماذا يحدث عند انتهاء الاشتراك؟',
    a: 'لديك فترة سماح 7 أيام للاطلاع على البيانات فقط. يمكنك تصدير كل بياناتك في أي وقت. إذا جدّدت خلال 30 يوماً تعود كل البيانات كما هي.',
  },
  {
    q: 'هل يمكنني إدارة أكثر من فرع؟',
    a: 'نعم. تعدد الفروع متاح في باقة المميز. كل فرع له إعداداته وتقاريره المستقلة مع لوحة تحكم موحدة للمالك.',
  },
];

export default function FAQ(): React.ReactElement {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="relative overflow-hidden py-24 sm:py-32">
      {/* Background */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-violet-300"
            style={{ border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.1)' }}
          >
            الأسئلة الشائعة
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            أسئلتك
            <span className="gradient-text"> مجاوبة</span>
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="overflow-hidden rounded-2xl transition-all duration-300"
              style={{
                border: openIdx === i
                  ? '1px solid rgba(168,85,247,0.35)'
                  : '1px solid rgba(255,255,255,0.06)',
                background: openIdx === i
                  ? 'rgba(168,85,247,0.06)'
                  : 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right"
              >
                <span className={`text-base font-semibold transition-colors ${openIdx === i ? 'text-white' : 'text-white/75'}`}>
                  {faq.q}
                </span>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300"
                  style={openIdx === i
                    ? { background: 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.4)', color: 'white' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }
                  }
                >
                  {openIdx === i ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openIdx === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="px-6 pb-6 text-sm leading-relaxed text-white/55">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
