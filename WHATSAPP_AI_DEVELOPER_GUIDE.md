# 🛠️ دليل تنفيذ ربط واتساب + AI — SERVIX

> **هذا الملف للمطور** — خطة تنفيذ تفصيلية خطوة بخطوة
> 📅 التاريخ: 12 أبريل 2026
> ⏱️ الوقت المقدر: 5-7 أيام عمل

---

## 📋 نظرة عامة

### ماذا نبني؟

3 مكونات رئيسية:

1. **بوت واتساب ذكي** — يستقبل رسائل العملاء ويرد عليهم عبر AI (حجز/أسعار/استفسار)
2. **مستشار AI للمديرة** — مدمج في لوحة التحكم، يجاوب عن بيانات الصالون
3. **تحكم صوتي** — المديرة ترسل مقطع صوتي على واتساب والبوت يفهم ويرد

### البنية التقنية:

```
Meta Cloud API (واتساب رسمي) ←→ SERVIX API (NestJS) ←→ Gemini Flash API (مجاني)
```

### النقاط الجوهرية:

- ✅ يستخدم `WhatsAppService` الموجود أصلاً في `apps/api/src/shared/whatsapp/`
- ✅ كل صالون (Tenant) عنده credentials واتساب خاصة فيه
- ✅ Gemini Flash مجاني — لا نحتاج مفاتيح مدفوعة
- ✅ العميل يبدأ المحادثة = الرد مجاني (نافذة 24 ساعة من Meta)
- ❌ لا نرسل رسائل صادرة بدون طلب (الباقة الأساسية)

---

## 📊 الملف الحالي والوضع القائم

### ملفات موجودة ومهمة:

| الملف | الوظيفة | الحالة |
|-------|---------|--------|
| `apps/api/src/shared/whatsapp/whatsapp.service.ts` | إرسال رسائل واتساب عبر Meta Graph API | ✅ موجود — يحتاج توسيع |
| `apps/api/src/shared/whatsapp/whatsapp.module.ts` | Module عام (@Global) | ✅ موجود |
| `apps/api/src/shared/sms/sms.service.ts` | إرسال SMS عبر Unifonic | ✅ موجود (مرجع للأسلوب) |
| `apps/api/src/shared/database/tenant-client.factory.ts` | إنشاء Prisma Client لكل Tenant | ✅ موجود |
| `apps/api/src/shared/database/platform-settings.service.ts` | إعدادات المنصة من DB | ✅ موجود |

### WhatsAppService الحالي يدعم:
- `send()` — إرسال رسالة نصية
- `sendDocument()` — إرسال ملف PDF
- يستقبل `WhatsAppCredentials` (token + phoneNumberId) لكل طلب
- يستخدم Meta Graph API `v21.0`

### ما يحتاج إضافة:
- استقبال رسائل (Webhook)
- ربط Gemini AI
- معالجة المقاطع الصوتية
- معالجة الصور
- Calendar link generation
- AI Consultant endpoint

---

## 🏗️ المرحلة 1: أساسيات الاستقبال والرد (يوم 1-2)

### المهمة 1.1: إنشاء Webhook Controller لاستقبال رسائل واتساب

**ملف جديد:** `apps/api/src/shared/whatsapp/whatsapp-webhook.controller.ts`

```typescript
import { Controller, Post, Get, Body, Query, RawBodyRequest, Req, Logger, HttpCode } from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';
import { WhatsAppBotService } from './whatsapp-bot.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly botService: WhatsAppBotService) {}

  /**
   * GET — Meta Webhook Verification
   * Meta يرسل هذا الطلب عند تسجيل الـ Webhook لأول مرة
   */
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'servix-webhook-verify';
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      this.logger.log('WhatsApp Webhook verified successfully');
      return challenge;
    }
    
    this.logger.warn('WhatsApp Webhook verification failed');
    return 'Forbidden';
  }

  /**
   * POST — استقبال الرسائل الواردة من Meta
   */
  @Public()
  @Post()
  @HttpCode(200)
  async handleIncoming(@Body() body: any): Promise<string> {
    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // تجاهل status updates (sent, delivered, read)
      if (value?.statuses) {
        return 'OK';
      }

      const message = value?.messages?.[0];
      const metadata = value?.metadata;

      if (!message || !metadata) {
        return 'OK';
      }

      // معالجة الرسالة في الخلفية (لا نخلي Meta ينتظر)
      this.botService.processIncomingMessage({
        from: message.from,                    // رقم المرسل
        phoneNumberId: metadata.phone_number_id, // رقم الصالون (يحدد الـ Tenant)
        messageType: message.type,             // text, audio, image, interactive
        text: message.text?.body,              // النص (لو نصية)
        audioId: message.audio?.id,            // Media ID (لو صوتية)
        imageId: message.image?.id,            // Media ID (لو صورة)
        interactive: message.interactive,       // الزر اللي ضغط عليه
        timestamp: message.timestamp,
        messageId: message.id,
      }).catch(err => {
        this.logger.error(`Failed to process message: ${err.message}`);
      });

      return 'OK';
    } catch (err) {
      this.logger.error(`Webhook error: ${(err as Error).message}`);
      return 'OK'; // دائماً نرجع 200 لـ Meta
    }
  }
}
```

---

### المهمة 1.2: إنشاء Bot Service (المعالج الرئيسي)

**ملف جديد:** `apps/api/src/shared/whatsapp/whatsapp-bot.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService, WhatsAppCredentials } from './whatsapp.service';
import { GeminiService } from '../ai/gemini.service';
import { TenantResolverService } from './tenant-resolver.service';

export interface IncomingMessage {
  from: string;
  phoneNumberId: string;
  messageType: 'text' | 'audio' | 'image' | 'interactive';
  text?: string;
  audioId?: string;
  imageId?: string;
  interactive?: any;
  timestamp: string;
  messageId: string;
}

@Injectable()
export class WhatsAppBotService {
  private readonly logger = new Logger(WhatsAppBotService.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly gemini: GeminiService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async processIncomingMessage(msg: IncomingMessage): Promise<void> {
    this.logger.log(`Incoming ${msg.messageType} from ${msg.from} to ${msg.phoneNumberId}`);

    // 1. حدد أي صالون (Tenant) بناءً على phoneNumberId
    const tenant = await this.tenantResolver.resolveByPhoneNumberId(msg.phoneNumberId);
    if (!tenant) {
      this.logger.warn(`No tenant found for phoneNumberId: ${msg.phoneNumberId}`);
      return;
    }

    // 2. جهّز بيانات الصالون لـ Gemini
    const salonContext = await this.tenantResolver.getSalonContext(tenant.id);

    // 3. استخرج نص الرسالة (حتى لو صوتية أو صورة)
    let userMessage = '';

    switch (msg.messageType) {
      case 'text':
        userMessage = msg.text || '';
        break;

      case 'audio':
        // حوّل الصوت لنص عبر Gemini
        const audioBuffer = await this.downloadMedia(msg.audioId!, tenant.credentials);
        userMessage = await this.gemini.transcribeAudio(audioBuffer);
        break;

      case 'image':
        // حلل الصورة عبر Gemini
        const imageBuffer = await this.downloadMedia(msg.imageId!, tenant.credentials);
        userMessage = await this.gemini.describeImage(imageBuffer);
        break;

      case 'interactive':
        // العميل ضغط زر
        userMessage = msg.interactive?.button_reply?.title 
                   || msg.interactive?.list_reply?.title 
                   || '';
        break;
    }

    if (!userMessage) return;

    // 4. أرسل لـ Gemini مع سياق الصالون
    const aiResponse = await this.gemini.chat({
      tenantId: tenant.id,
      userPhone: msg.from,
      userMessage,
      salonContext,
    });

    // 5. أرسل الرد عبر واتساب
    await this.whatsapp.send(
      { to: msg.from, message: aiResponse },
      tenant.credentials,
    );
  }

  /**
   * تحميل ملف وسائط من Meta (صوت/صورة)
   */
  private async downloadMedia(mediaId: string, credentials: WhatsAppCredentials): Promise<Buffer> {
    // الخطوة 1: احصل على رابط التحميل
    const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${credentials.token}` },
    });
    const { url } = (await metaRes.json()) as { url: string };

    // الخطوة 2: حمّل الملف
    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.token}` },
    });
    const arrayBuffer = await fileRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

---

### المهمة 1.3: إنشاء Tenant Resolver (يحدد أي صالون من رقم الواتساب)

**ملف جديد:** `apps/api/src/shared/whatsapp/tenant-resolver.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaClient } from '../database/platform.client';
import { TenantClientFactory } from '../database/tenant-client.factory';
import { CacheService } from '../cache/cache.service';
import { WhatsAppCredentials } from './whatsapp.service';

interface ResolvedTenant {
  id: string;
  slug: string;
  databaseName: string;
  salonName: string;
  credentials: WhatsAppCredentials;
}

interface SalonContext {
  salonName: string;
  services: Array<{ name: string; price: number; duration: number; category: string }>;
  employees: Array<{ name: string; role: string }>;
  workingHours: string;
  availableSlots: Array<{ date: string; time: string; employee: string }>;
  clientInfo?: { name: string; visits: number; loyaltyPoints: number; lastVisit: string };
}

@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  constructor(
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly cache: CacheService,
  ) {}

  /**
   * حدد الـ Tenant بناءً على WhatsApp Phone Number ID
   * كل صالون عنده phoneNumberId مسجل في جدول tenant_settings
   */
  async resolveByPhoneNumberId(phoneNumberId: string): Promise<ResolvedTenant | null> {
    // Cache key لتسريع البحث
    const cacheKey = `wa:tenant:${phoneNumberId}`;
    
    // حاول من الكاش أولاً
    // لو ما لقيت، ابحث في قاعدة البيانات:
    // SELECT * FROM tenants WHERE whatsapp_phone_number_id = ?
    // يحتاج إضافة عمود whatsapp_phone_number_id و whatsapp_token 
    // في جدول tenants أو جدول tenant_settings في platform DB
    
    try {
      const tenant = await this.platformPrisma.tenant.findFirst({
        where: {
          settings: {
            path: ['whatsapp_phone_number_id'],
            equals: phoneNumberId,
          },
        },
      });
      
      if (!tenant) return null;
      
      return {
        id: tenant.id,
        slug: tenant.slug,
        databaseName: tenant.databaseName,
        salonName: tenant.name,
        credentials: {
          token: (tenant.settings as any)?.whatsapp_token || '',
          phoneNumberId,
        },
      };
    } catch (err) {
      this.logger.error(`Failed to resolve tenant: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * سحب بيانات الصالون لإرسالها لـ Gemini كـ context
   */
  async getSalonContext(tenantId: string): Promise<SalonContext> {
    // اتصل بقاعدة بيانات الصالون عبر TenantClientFactory
    // واسحب: الخدمات، الموظفين، المواعيد المتاحة، بيانات العميل
    
    // ⚠️ ملاحظة للمطور:
    // استخدم TenantClientFactory.getClient(databaseName) للحصول على Prisma Client
    // ثم اسحب البيانات المطلوبة:
    //   - services: SELECT name, price, duration FROM services WHERE is_active = true
    //   - employees: SELECT name, role FROM employees WHERE is_active = true  
    //   - appointments: SELECT date, time, employee FROM appointments WHERE date >= TODAY
    //   - client: SELECT * FROM clients WHERE phone = ?
    
    // هذا placeholder — المطور يعبّيه حسب schema الفعلي
    return {
      salonName: '',
      services: [],
      employees: [],
      workingHours: '',
      availableSlots: [],
    };
  }
}
```

---

## 🧠 المرحلة 2: ربط Gemini AI (يوم 2-3)

### المهمة 2.1: إنشاء Gemini Service

**ملف جديد:** `apps/api/src/shared/ai/gemini.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ChatOptions {
  tenantId: string;
  userPhone: string;
  userMessage: string;
  salonContext: any;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly model = 'gemini-2.0-flash';
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  // ذاكرة قصيرة للمحادثات (per user per tenant)
  // في الإنتاج استخدم Redis
  private conversationHistory = new Map<string, Array<{role: string, text: string}>>();

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
  }

  /**
   * محادثة ذكية مع سياق الصالون
   */
  async chat(options: ChatOptions): Promise<string> {
    const { tenantId, userPhone, userMessage, salonContext } = options;
    const historyKey = `${tenantId}:${userPhone}`;

    // سحب تاريخ المحادثة
    const history = this.conversationHistory.get(historyKey) || [];

    const systemPrompt = this.buildSystemPrompt(salonContext);
    
    // أضف رسالة المستخدم للتاريخ
    history.push({ role: 'user', text: userMessage });

    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'فهمت، أنا جاهز لمساعدة عملاء الصالون.' }] },
        ...history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        })),
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Gemini API error: ${response.status} ${err}`);
        return 'عذراً، حدث خطأ. جرب مرة ثانية أو تواصل مع الصالون مباشرة.';
      }

      const data = await response.json() as any;
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، ما قدرت أفهم. جرب مرة ثانية.';

      // أضف رد البوت للتاريخ
      history.push({ role: 'model', text: reply });
      
      // احتفظ بآخر 20 رسالة فقط
      if (history.length > 20) history.splice(0, history.length - 20);
      this.conversationHistory.set(historyKey, history);

      return reply;
    } catch (err) {
      this.logger.error(`Gemini chat failed: ${(err as Error).message}`);
      return 'عذراً، حدث خطأ تقني. حاول مرة ثانية.';
    }
  }

  /**
   * تحويل مقطع صوتي لنص
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const base64Audio = audioBuffer.toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'حوّل هذا المقطع الصوتي لنص. أرجع النص فقط بدون أي إضافات.' },
            { inlineData: { mimeType: 'audio/ogg', data: base64Audio } },
          ],
        }],
      }),
    });

    const data = await response.json() as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * وصف/تحليل صورة
   */
  async describeImage(imageBuffer: Buffer): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const base64Image = imageBuffer.toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'العميل أرسل هذه الصورة في محادثة صالون حلاقة/تجميل. وصف ماذا يريد العميل بناءً على الصورة. لو فيها قصة شعر، حدد نوعها.' },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        }],
      }),
    });

    const data = await response.json() as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'أرسل العميل صورة';
  }

  /**
   * المستشار الذكي للمديرة (endpoint منفصل)
   */
  async consultantChat(tenantId: string, question: string, salonData: any): Promise<string> {
    const systemPrompt = this.buildConsultantPrompt(salonData);

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'فهمت بيانات الصالون. أنا جاهز لمساعدتك.' }] },
          { role: 'user', parts: [{ text: question }] },
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.5,
        },
      }),
    });

    const data = await response.json() as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، حاول مرة ثانية.';
  }

  // ─── Private Helpers ───

  private buildSystemPrompt(context: any): string {
    return `أنت موظف استقبال ذكي في "${context.salonName}".

مهامك:
1. الترحيب بالعملاء بلطف
2. عرض الخدمات والأسعار
3. مساعدة العملاء في حجز المواعيد
4. الإجابة على الاستفسارات
5. اقتراح خدمات إضافية بذكاء (Upsell)

القواعد:
- رد باختصار (لا تزيد عن 3-4 أسطر)
- استخدم إيموجي بشكل معتدل
- لو العميل يتكلم إنجليزي رد إنجليزي، لو عربي رد عربي
- لا تختلق معلومات — لو ما تعرف قل "خليني أحولك لموظف"
- في نهاية الحجز أضف: "📅 أضف لتقويمك: [رابط]"

بيانات الصالون:
- الخدمات: ${JSON.stringify(context.services || [])}
- الموظفين: ${JSON.stringify(context.employees || [])}
- المواعيد المتاحة: ${JSON.stringify(context.availableSlots || [])}
- ساعات العمل: ${context.workingHours || 'غير محدد'}
${context.clientInfo ? `
بيانات العميل:
- الاسم: ${context.clientInfo.name}
- عدد الزيارات: ${context.clientInfo.visits}
- نقاط الولاء: ${context.clientInfo.loyaltyPoints}
- آخر زيارة: ${context.clientInfo.lastVisit}
` : ''}`;
  }

  private buildConsultantPrompt(data: any): string {
    return `أنت مستشار أعمال محترف متخصص في صالونات التجميل والحلاقة في السعودية.

مهامك:
1. تحليل بيانات الصالون وتقديم نصائح عملية
2. اقتراح تحسينات للتسعير
3. اقتراح أفكار تسويقية
4. تحليل أداء الموظفين
5. التوقعات المالية

القواعد:
- استخدم أرقام حقيقية من البيانات المرفقة فقط
- لا تختلق أرقاماً
- قدم نصائح عملية قابلة للتنفيذ
- استخدم العملة: ريال سعودي

بيانات الصالون:
${JSON.stringify(data, null, 2)}`;
  }
}
```

### المهمة 2.2: إنشاء AI Module

**ملف جديد:** `apps/api/src/shared/ai/ai.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Global()
@Module({
  providers: [GeminiService],
  exports: [GeminiService],
})
export class AiModule {}
```

**ملف جديد:** `apps/api/src/shared/ai/index.ts`

```typescript
export { AiModule } from './ai.module';
export { GeminiService } from './gemini.service';
```

---

## 📅 المرحلة 3: روابط التقويم التلقائية (يوم 3)

### المهمة 3.1: إنشاء Calendar Service

**ملف جديد:** `apps/api/src/shared/calendar/calendar.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface CalendarEventOptions {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  reminderMinutes?: number[];
}

@Injectable()
export class CalendarService {
  /**
   * توليد رابط Google Calendar
   */
  generateGoogleCalendarUrl(options: CalendarEventOptions): string {
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: options.title,
      dates: `${formatDate(options.startDate)}/${formatDate(options.endDate)}`,
      details: options.description,
      location: options.location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * توليد ملف .ics (يعمل مع Apple Calendar وغيره)
   */
  generateIcsFile(options: CalendarEventOptions): string {
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const reminders = (options.reminderMinutes || [60, 1440]) // ساعة + 24 ساعة
      .map(m => `BEGIN:VALARM\nTRIGGER:-PT${m}M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM`)
      .join('\n');

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SERVIX//Salon Booking//AR
BEGIN:VEVENT
DTSTART:${formatDate(options.startDate)}
DTEND:${formatDate(options.endDate)}
SUMMARY:${options.title}
DESCRIPTION:${options.description}
LOCATION:${options.location}
${reminders}
END:VEVENT
END:VCALENDAR`;
  }

  /**
   * توليد رابط مختصر يختار التقويم المناسب (Google أو Apple)
   * يُستخدم في رسائل الواتساب
   */
  generateBookingCalendarMessage(
    serviceName: string,
    employeeName: string,
    salonName: string,
    salonAddress: string,
    date: Date,
    durationMinutes: number,
    price: number,
  ): string {
    const endDate = new Date(date.getTime() + durationMinutes * 60000);

    const googleUrl = this.generateGoogleCalendarUrl({
      title: `✂️ ${serviceName} - ${salonName}`,
      description: `مع: ${employeeName} | السعر: ${price} ريال`,
      location: salonAddress,
      startDate: date,
      endDate,
    });

    return `📅 أضف الموعد لتقويمك:\n${googleUrl}`;
  }
}
```

---

## 🧑‍💼 المرحلة 4: المستشار الذكي في لوحة التحكم (يوم 4)

### المهمة 4.1: إنشاء AI Consultant Controller

**ملف جديد:** `apps/api/src/modules/salon/ai-consultant/ai-consultant.controller.ts`

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiConsultantService } from './ai-consultant.service';
import { CurrentTenant } from '../../../decorators/current-tenant.decorator';

@Controller('salon/ai-consultant')
export class AiConsultantController {

  constructor(private readonly consultantService: AiConsultantService) {}

  /**
   * POST /api/v1/salon/ai-consultant/ask
   * المديرة تسأل AI عن صالونها
   */
  @Post('ask')
  async ask(
    @CurrentTenant() tenant: { id: string; databaseName: string },
    @Body('question') question: string,
  ) {
    const answer = await this.consultantService.ask(tenant, question);
    return { answer };
  }
}
```

### المهمة 4.2: إنشاء AI Consultant Service

**ملف جديد:** `apps/api/src/modules/salon/ai-consultant/ai-consultant.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../../shared/ai/gemini.service';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';

@Injectable()
export class AiConsultantService {
  private readonly logger = new Logger(AiConsultantService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly tenantFactory: TenantClientFactory,
  ) {}

  async ask(tenant: { id: string; databaseName: string }, question: string): Promise<string> {
    // 1. سحب بيانات الصالون الشاملة
    const salonData = await this.gatherSalonData(tenant.databaseName);

    // 2. إرسال لـ Gemini
    return this.gemini.consultantChat(tenant.id, question, salonData);
  }

  private async gatherSalonData(databaseName: string): Promise<any> {
    // ⚠️ المطور يكمل هنا حسب schema الفعلي
    // استخدم: this.tenantFactory.getClient(databaseName)
    // 
    // البيانات المطلوبة:
    // - إيرادات الشهر الحالي و الماضي (invoices)
    // - عدد العملاء الجدد والعائدين (clients)
    // - أكثر الخدمات طلباً (appointment_services)
    // - أداء الموظفين (appointments per employee)
    // - نسبة الحضور vs الإلغاء (appointments.status)
    // - المصروفات (expenses)
    // - ساعات الذروة (appointments.time distribution)
    // - العملاء الغائبين +30 يوم (clients.last_visit)
    // - المخزون المنخفض (inventory)
    // - نقاط الولاء (loyalty)

    return {
      // placeholder - المطور يعبّيه
      revenue: { current_month: 0, last_month: 0 },
      clients: { total: 0, new_this_month: 0, returning: 0 },
      top_services: [],
      employees_performance: [],
      cancellation_rate: 0,
      peak_hours: [],
    };
  }
}
```

### المهمة 4.3: إنشاء Module

**ملف جديد:** `apps/api/src/modules/salon/ai-consultant/ai-consultant.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AiConsultantController } from './ai-consultant.controller';
import { AiConsultantService } from './ai-consultant.service';

@Module({
  controllers: [AiConsultantController],
  providers: [AiConsultantService],
})
export class AiConsultantModule {}
```

---

## 🔧 المرحلة 5: التكامل والإعدادات (يوم 5)

### المهمة 5.1: تحديث app.module.ts

أضف في imports:

```typescript
import { AiModule } from './shared/ai';
// ...

@Module({
  imports: [
    // ... الموجود
    AiModule,        // ← جديد
    // ...
  ],
})
```

### المهمة 5.2: تحديث WhatsApp Module

عدّل `apps/api/src/shared/whatsapp/whatsapp.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { TenantResolverService } from './tenant-resolver.service';

@Global()
@Module({
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppService, WhatsAppBotService, TenantResolverService],
  exports: [WhatsAppService, WhatsAppBotService],
})
export class WhatsAppModule {}
```

### المهمة 5.3: تحديث salon.module.ts

أضف `AiConsultantModule`:

```typescript
import { AiConsultantModule } from './ai-consultant/ai-consultant.module';

@Module({
  imports: [
    // ... الموجود
    AiConsultantModule,  // ← جديد
  ],
})
export class SalonModule {}
```

### المهمة 5.4: متغيرات البيئة (.env)

أضف في `.env`:

```env
# ─── Gemini AI ───
GEMINI_API_KEY=                          # من https://aistudio.google.com/apikey (مجاني)

# ─── WhatsApp Webhook ───
WHATSAPP_WEBHOOK_VERIFY_TOKEN=servix-webhook-verify-2026   # توكن تحقق مخصص
```

### المهمة 5.5: تسجيل Webhook في Meta

1. ادخل على https://developers.facebook.com
2. اختر تطبيقك → WhatsApp → Configuration
3. في قسم Webhook:
   - Callback URL: `https://api.servi-x.com/api/v1/webhooks/whatsapp`
   - Verify Token: نفس القيمة في `.env`
   - اشترك في: `messages`

---

## 🖥️ المرحلة 6: واجهة المستشار في الداشبورد (يوم 5-6)

### المهمة 6.1: إنشاء صفحة المستشار الذكي في Dashboard

**المسار:** `apps/dashboard/src/app/[locale]/(dashboard)/ai-consultant/page.tsx`

```
الصفحة تحتوي:
├── شريط إدخال (مثل ChatGPT) — المديرة تكتب سؤالها
├── زر ميكروفون 🎙️ — تقدر تتكلم بدل ما تكتب (Web Speech API)
├── منطقة عرض الردود — فقاعات محادثة
├── اقتراحات سريعة:
│   ├── "كم إيرادات اليوم؟"
│   ├── "مين أحسن موظف هالشهر؟"
│   ├── "أعطيني أفكار تسويقية"
│   └── "هل أسعاري مناسبة؟"
└── تصميم: بطاقة في الداشبورد أو صفحة كاملة

API Call:
POST /api/v1/salon/ai-consultant/ask
Body: { "question": "كم إيرادات اليوم؟" }
Response: { "answer": "إيراداتك اليوم 4,200 ريال..." }

للصوت:
- استخدم Web Speech API (مجاني ومدمج في المتصفح)
- const recognition = new webkitSpeechRecognition()
- recognition.lang = 'ar-SA'
- المديرة تضغط 🎙️ → تتكلم → المتصفح يحوّل لنص → يرسل للـ API
- الرد يُقرأ بصوت: speechSynthesis.speak(new SpeechSynthesisUtterance(answer))
```

---

## 📂 ملخص الملفات الجديدة

```
apps/api/src/
├── shared/
│   ├── ai/                              ← 🆕 مجلد جديد
│   │   ├── ai.module.ts
│   │   ├── gemini.service.ts
│   │   └── index.ts
│   ├── calendar/                        ← 🆕 مجلد جديد
│   │   ├── calendar.module.ts
│   │   ├── calendar.service.ts
│   │   └── index.ts
│   └── whatsapp/
│       ├── whatsapp.module.ts           ← 📝 تعديل
│       ├── whatsapp.service.ts          ← 📝 بدون تغيير
│       ├── whatsapp-bot.service.ts      ← 🆕 جديد
│       ├── whatsapp-webhook.controller.ts ← 🆕 جديد
│       ├── tenant-resolver.service.ts   ← 🆕 جديد
│       └── index.ts                     ← 📝 تعديل (أضف exports)
├── modules/
│   └── salon/
│       ├── ai-consultant/               ← 🆕 مجلد جديد
│       │   ├── ai-consultant.module.ts
│       │   ├── ai-consultant.controller.ts
│       │   └── ai-consultant.service.ts
│       └── salon.module.ts              ← 📝 تعديل (أضف AiConsultantModule)
├── app.module.ts                        ← 📝 تعديل (أضف AiModule)

apps/dashboard/src/
└── app/[locale]/(dashboard)/
    └── ai-consultant/                   ← 🆕 صفحة جديدة
        └── page.tsx

.env                                     ← 📝 تعديل (أضف GEMINI_API_KEY)
```

---

## ✅ قائمة التحقق (Checklist)

```
المرحلة 1: الاستقبال والرد
[ ] إنشاء WhatsAppWebhookController
[ ] إنشاء WhatsAppBotService
[ ] إنشاء TenantResolverService
[ ] تحديث WhatsAppModule
[ ] اختبار: إرسال رسالة واتساب والتأكد من وصولها للـ Webhook

المرحلة 2: ربط Gemini
[ ] إنشاء GeminiService (chat + transcribeAudio + describeImage)
[ ] إنشاء AiModule
[ ] تحديث app.module.ts
[ ] الحصول على GEMINI_API_KEY المجاني
[ ] اختبار: إرسال رسالة والحصول على رد ذكي

المرحلة 3: التقويم
[ ] إنشاء CalendarService
[ ] ربطه مع البوت (يرسل رابط تقويم بعد الحجز)
[ ] اختبار: التأكد من أن رابط التقويم يعمل

المرحلة 4: المستشار الذكي
[ ] إنشاء AiConsultantController
[ ] إنشاء AiConsultantService (سحب بيانات الصالون الشاملة)
[ ] تحديث SalonModule
[ ] اختبار: POST /salon/ai-consultant/ask

المرحلة 5: التكامل
[ ] تحديث .env
[ ] تسجيل Webhook URL في Meta
[ ] اختبار شامل: رسالة نصية → رد ذكي
[ ] اختبار شامل: مقطع صوتي → رد ذكي
[ ] اختبار شامل: صورة → رد ذكي

المرحلة 6: الداشبورد
[ ] تصميم صفحة المستشار الذكي
[ ] ربط Web Speech API (الميكروفون)
[ ] ربط Text-to-Speech (قراءة الرد بصوت)
[ ] اختبار: المديرة تسأل وتحصل على جواب

المرحلة 7 (لاحقاً):
[ ] Siri Shortcut "يا سيرفكس"
[ ] multi-language auto-detection
[ ] إحالات ذكية
[ ] Upsell analytics
```

---

## 🔑 متطلبات خارجية

| المتطلب | الرابط | مجاني؟ |
|---------|--------|--------|
| **Gemini API Key** | https://aistudio.google.com/apikey | ✅ نعم |
| **Meta Business Account** | https://business.facebook.com | ✅ نعم |
| **WhatsApp Business API** | https://developers.facebook.com | ✅ نعم (الاستقبال مجاني) |

---

## ⚠️ ملاحظات مهمة للمطور

1. **لا تنسى `@Public()`** على Webhook Controller — Meta يرسل بدون JWT
2. **دائماً ارجع 200** في الـ Webhook حتى لو فيه خطأ — وإلا Meta يوقف الإرسال
3. **عالج الرسائل بشكل غير متزامن** (`processIncomingMessage().catch(...)`) — لا تخلي Meta ينتظر
4. **ذاكرة المحادثات** في الإنتاج لازم تكون في Redis مو في الـ RAM
5. **TenantResolver** يحتاج تعديل حسب كيف تحفظ credentials كل Tenant — راجع schema الحالي
6. **الـ Webhook URL لازم يكون HTTPS** — تأكد من أن nginx يوجّه المسار صح
7. **الحد المجاني لـ Gemini: 15 طلب/دقيقة** — أضف rate limiting لو لزم
8. **إخفاء البيانات الشخصية (مطلب قانوني PDPL)** — قبل إرسال أي شي لـ Gemini:
   - احذف اسم العميل الحقيقي ← استبدله بـ "العميل"
   - احذف رقم الجوال بالكامل
   - أرسل فقط: نوع الخدمة، الأسعار، المواعيد، نقاط الولاء (رقم فقط)
   - بعد استقبال رد Gemini ← أعد إضافة اسم العميل في الرسالة النهائية
   - هذا يضمن التوافق مع نظام حماية البيانات الشخصية السعودي (PDPL)

---

## 🔐 تفصيل إخفاء البيانات (Data Anonymization)

### مثال عملي في الكود:

```typescript
// في whatsapp-bot.service.ts — قبل إرسال السياق لـ Gemini:

private anonymizeContext(context: SalonContext): SalonContext {
  return {
    ...context,
    // احذف اسم العميل
    clientInfo: context.clientInfo ? {
      name: 'العميل',  // ← بدل الاسم الحقيقي
      visits: context.clientInfo.visits,
      loyaltyPoints: context.clientInfo.loyaltyPoints,
      lastVisit: context.clientInfo.lastVisit,
    } : undefined,
  };
}

// في الرد — أعد الاسم:
private personalizeResponse(response: string, clientName?: string): string {
  if (clientName) {
    return response.replace(/العميل/g, clientName);
  }
  return response;
}
```

### الفلسفة:
```
الوارد (من العميل): "أنا محمد، أبي موعد"
     ↓
إلى Gemini: "العميل يريد حجز موعد" (بدون اسم)
     ↓
من Gemini: "أهلاً! المواعيد المتاحة..."
     ↓
إلى العميل: "أهلاً يا محمد! المواعيد المتاحة..." (أعدنا الاسم)
```
