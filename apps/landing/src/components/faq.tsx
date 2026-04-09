'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

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
  const { t } = useI18n();

  return (
    <section id="faq" className="relative overflow-hidden py-24 sm:py-32">
      <div className="relative mx-auto max-w-3xl px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-14 text-center"
        >
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--fg)' }}>
            {t('faq.title')}{' '}
            <span style={{ color: 'var(--gold)' }}>{t('faq.titleAccent')}</span>
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIdx === i;
            return (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
                className="overflow-hidden rounded-xl transition-all duration-300"
                style={{
                  border: isOpen ? '1px solid var(--border-gold)' : '1px solid var(--border)',
                  background: isOpen ? 'var(--bg-surface)' : 'transparent',
                }}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right"
                >
                  <span
                    className="text-base font-semibold transition-colors"
                    style={{ color: isOpen ? 'var(--fg)' : 'var(--fg-secondary)' }}
                  >
                    {faq.q}
                  </span>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300"
                    style={isOpen
                      ? { background: 'rgba(200,169,126,0.15)', border: '1px solid var(--border-gold)', color: 'var(--gold)' }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }
                    }
                  >
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <p className="px-6 pb-6 text-sm leading-relaxed" style={{ color: 'var(--fg-secondary)' }}>
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
