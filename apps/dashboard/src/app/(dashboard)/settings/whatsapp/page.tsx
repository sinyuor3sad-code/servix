'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, MessageCircle, Bot, Sparkles, Clock } from 'lucide-react';

export default function WhatsAppSettingsPage(): React.ReactElement {
  const router = useRouter();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">واتساب</h1>
          <p className="text-xs text-[var(--muted-foreground)]">ربط واتساب بالبوت الذكي</p>
        </div>
      </div>

      {/* Coming Soon Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-10">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-gradient-to-tr from-green-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <MessageCircle className="h-10 w-10 text-emerald-400" />
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">قريباً</span>
            </div>
            <h2 className="text-2xl font-black text-white">واتساب الذكي</h2>
            <p className="text-sm text-white/40 mt-2 max-w-md mx-auto leading-relaxed">
              نعمل حالياً على تطوير تكامل واتساب المتقدم مع البوت الذكي — سيتم إطلاقه قريباً بمزايا استثنائية
            </p>
          </div>
        </div>
      </div>

      {/* Features Preview */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">مزايا قادمة</h3>
              <p className="text-[10px] text-[var(--muted-foreground)]">ما ستحصل عليه عند الإطلاق</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { emoji: '🤖', title: 'رد ذكي تلقائي', desc: 'يجاوب أسئلة العملاء عن الخدمات والأسعار والمواعيد' },
              { emoji: '🎤', title: 'يفهم الصوت', desc: 'يحوّل الرسائل الصوتية لنص ويجاوب عليها' },
              { emoji: '📅', title: 'حجز + تقويم', desc: 'يحجز موعد ويرسل رابط يضيف الموعد للتقويم تلقائياً' },
              { emoji: '🧾', title: 'إرسال الفاتورة', desc: 'يرسل الفاتورة PDF بعد الدفع تلقائياً' },
              { emoji: '📷', title: 'يحلل الصور', desc: 'يشوف الصور ويفهم ما يريده العميل' },
              { emoji: '📢', title: 'حملات تسويقية', desc: 'عروض وخصومات مباشرة لعملائك' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3.5 opacity-60">
                <span className="text-xl">{item.emoji}</span>
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notify */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-sm">ترقّب الإطلاق</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
              سنُخطرك فور جاهزية ميزة واتساب الذكي — ستتمكن من ربط رقم صالونك بضغطة زر واحدة والبوت الذكي يبدأ بالرد على عملائك تلقائياً 24/7.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
