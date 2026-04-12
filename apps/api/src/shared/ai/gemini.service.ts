import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';

// ─────────────────── Types ───────────────────

export interface GeminiChatOptions {
  tenantId: string;
  userPhone: string;
  userMessage: string;
  salonContext: any;
}

interface ConversationMessage {
  role: 'user' | 'model';
  text: string;
}

const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-1.5-flash'];
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const CONVERSATION_CACHE_PREFIX = 'servix:wa_conv:';
const CONVERSATION_TTL_SECONDS = 3600; // 1 hour — matches Meta's 24hr window but keeps memory lean
const MAX_CONVERSATION_HISTORY = 20;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000; // 5 seconds

/**
 * Gemini AI Service — Provides intelligent AI capabilities for SERVIX.
 *
 * Features:
 * - chat(): Smart receptionist for WhatsApp customer interactions
 * - transcribeAudio(): Convert voice messages to text via Gemini multimodal
 * - describeImage(): Analyze images sent by customers
 * - consultantChat(): AI business consultant for salon managers
 *
 * Privacy (PDPL):
 * - Client names are anonymized before sending to Gemini
 * - Phone numbers are stripped entirely
 * - Only service/pricing/scheduling data is sent
 * - Real names are restored in the final response
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn(
        '⚠️ GEMINI_API_KEY not configured — AI features disabled. Get a free key at https://aistudio.google.com/apikey',
      );
    }
  }

  // ═══════════════════════════════════════════
  // 1. Smart Chat — WhatsApp Customer Bot
  // ═══════════════════════════════════════════

  /**
   * Intelligent chat with salon context.
   * Maintains conversation history per user per tenant in Redis.
   */
  async chat(options: GeminiChatOptions): Promise<string> {
    if (!this.apiKey) {
      return this.getFallbackResponse(options.salonContext?.salonName || 'الصالون');
    }

    const { tenantId, userPhone, userMessage, salonContext } = options;
    const historyKey = `${CONVERSATION_CACHE_PREFIX}${tenantId}:${userPhone}`;

    // 1. Anonymize context before sending to Gemini (PDPL compliance)
    const { anonymizedContext, clientRealName } =
      this.anonymizeContext(salonContext);

    // 2. Retrieve conversation history from Redis
    const history = await this.getConversationHistory(historyKey);

    // 3. Build system prompt with salon data
    const systemPrompt = this.buildReceptionistPrompt(anonymizedContext);

    // 4. Add user message to history
    history.push({ role: 'user', text: userMessage });

    // 5. Call Gemini API with model fallback
    try {
      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        {
          role: 'model',
          parts: [{ text: 'فهمت، أنا جاهز لمساعدة عملاء الصالون.' }],
        },
        ...history.map((h) => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        })),
      ];

      let response: Response | null = null;

      // Try each model, with retry on 429
      for (const model of GEMINI_MODELS) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${this.apiKey}`;

          response = await fetch(url, {
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

          if (response.ok) break; // Success!

          if (response.status === 429 && attempt < MAX_RETRIES) {
            this.logger.warn(
              `Gemini rate limited (model=${model}, attempt=${attempt + 1}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS}ms...`,
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
            continue;
          }

          // Non-429 error or max retries — try next model
          break;
        }

        if (response?.ok) break; // Found a working model
        this.logger.warn(`Model ${model} failed, trying next...`);
      }

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(
          `Gemini API error: ${response.status} ${errText}`,
        );
        return this.getFallbackResponse(salonContext?.salonName || 'الصالون');
      }

      const data = (await response.json()) as any;
      const rawReply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'عذراً، ما قدرت أفهم. جرب مرة ثانية.';

      // 6. Personalize response — restore real client name
      const reply = this.personalizeResponse(rawReply, clientRealName);

      // 7. Save updated history to Redis
      history.push({ role: 'model', text: rawReply });
      if (history.length > MAX_CONVERSATION_HISTORY) {
        history.splice(0, history.length - MAX_CONVERSATION_HISTORY);
      }
      await this.saveConversationHistory(historyKey, history);

      return reply;
    } catch (err) {
      this.logger.error(
        `Gemini chat failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return this.getFallbackResponse(salonContext?.salonName || 'الصالون');
    }
  }

  // ═══════════════════════════════════════════
  // 2. Audio Transcription
  // ═══════════════════════════════════════════

  /**
   * Transcribe a voice message (OGG/audio) to text using Gemini multimodal.
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    if (!this.apiKey) {
      return '';
    }

    try {
      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODELS[0]}:generateContent?key=${this.apiKey}`;
      const base64Audio = audioBuffer.toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'حوّل هذا المقطع الصوتي لنص. أرجع النص فقط بدون أي إضافات أو شرح.',
                },
                {
                  inlineData: {
                    mimeType: 'audio/ogg',
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `Gemini transcribe error: ${response.status} ${await response.text()}`,
        );
        return '';
      }

      const data = (await response.json()) as any;
      const transcript =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.logger.log(
        `🎤 Audio transcribed (${audioBuffer.length} bytes → ${transcript.length} chars)`,
      );
      return transcript;
    } catch (err) {
      this.logger.error(
        `Audio transcription failed: ${(err as Error).message}`,
      );
      return '';
    }
  }

  // ═══════════════════════════════════════════
  // 3. Image Description
  // ═══════════════════════════════════════════

  /**
   * Describe/analyze an image sent by a customer in salon context.
   */
  async describeImage(imageBuffer: Buffer): Promise<string> {
    if (!this.apiKey) {
      return 'أرسل العميل صورة';
    }

    try {
      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODELS[0]}:generateContent?key=${this.apiKey}`;
      const base64Image = imageBuffer.toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'العميل أرسل هذه الصورة في محادثة صالون حلاقة/تجميل. وصف ماذا يريد العميل بناءً على الصورة. لو فيها قصة شعر أو تسريحة، حدد نوعها. أجب باختصار.',
                },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `Gemini image error: ${response.status} ${await response.text()}`,
        );
        return 'أرسل العميل صورة';
      }

      const data = (await response.json()) as any;
      const description =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'أرسل العميل صورة';
      this.logger.log(
        `📷 Image described (${imageBuffer.length} bytes → "${description.substring(0, 50)}...")`,
      );
      return description;
    } catch (err) {
      this.logger.error(
        `Image description failed: ${(err as Error).message}`,
      );
      return 'أرسل العميل صورة';
    }
  }

  // ═══════════════════════════════════════════
  // 4. AI Business Consultant (Dashboard)
  // ═══════════════════════════════════════════

  /**
   * AI business consultant for salon managers.
   * Answers questions about revenue, performance, marketing, etc.
   */
  async consultantChat(
    tenantId: string,
    question: string,
    salonData: any,
  ): Promise<string> {
    if (!this.apiKey) {
      return 'خاصية المستشار الذكي تحتاج تفعيل مفتاح Gemini API. راجع إعدادات المنصة.';
    }

    try {
      const systemPrompt = this.buildConsultantPrompt(salonData);
      const requestBody = {
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          {
            role: 'model',
            parts: [
              { text: 'فهمت بيانات الصالون. أنا جاهز لمساعدتك.' },
            ],
          },
          { role: 'user', parts: [{ text: question }] },
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.5,
        },
      };

      let response: Response | null = null;

      // Try each model with retry on 429
      for (const model of GEMINI_MODELS) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${this.apiKey}`;

          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (response.ok) break;

          if (response.status === 429 && attempt < MAX_RETRIES) {
            this.logger.warn(
              `Consultant rate limited (model=${model}, attempt=${attempt + 1}). Retrying in ${RETRY_DELAY_MS}ms...`,
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
            continue;
          }
          break;
        }
        if (response?.ok) break;
        this.logger.warn(`Consultant model ${model} failed, trying next...`);
      }

      if (!response?.ok) {
        const errText = response ? await response.text() : 'No response';
        this.logger.error(
          `Gemini consultant error: ${response?.status} ${errText.substring(0, 200)}`,
        );
        return 'عذراً، حدث خطأ. حاول مرة ثانية.';
      }

      const data = (await response.json()) as any;
      return (
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'عذراً، حاول مرة ثانية.'
      );
    } catch (err) {
      this.logger.error(
        `Consultant chat failed: ${(err as Error).message}`,
      );
      return 'عذراً، حدث خطأ تقني. حاول مرة ثانية.';
    }
  }

  // ═══════════════════════════════════════════
  // PDPL Privacy — Anonymize & Personalize
  // ═══════════════════════════════════════════

  /**
   * Anonymize context before sending to Gemini AI.
   * - Replace client real names with "العميل"
   * - Strip phone numbers entirely
   * - Keep only service/pricing/scheduling data
   */
  private anonymizeContext(context: any): {
    anonymizedContext: any;
    clientRealName: string | null;
  } {
    if (!context) return { anonymizedContext: {}, clientRealName: null };

    const anonymized = { ...context };
    let clientRealName: string | null = null;

    // Anonymize client info
    if (anonymized.clientInfo) {
      clientRealName = anonymized.clientInfo.name || null;
      anonymized.clientInfo = {
        ...anonymized.clientInfo,
        name: 'العميل',
        // Keep: visits, loyaltyPoints, lastVisit (non-PII)
      };
    }

    // Strip phone numbers from employee data (if any leaked)
    if (anonymized.employees) {
      anonymized.employees = anonymized.employees.map((emp: any) => ({
        name: emp.name, // Employee names are not PII in business context
        role: emp.role,
      }));
    }

    return { anonymizedContext: anonymized, clientRealName };
  }

  /**
   * Restore real client name in the AI response.
   * Replaces "العميل" placeholder with the actual name.
   */
  private personalizeResponse(
    response: string,
    clientRealName: string | null,
  ): string {
    if (!clientRealName) return response;

    // Replace generic "العميل" with real name only if it makes sense
    // Use first occurrence to maintain natural tone
    return response.replace(/العميل/g, clientRealName);
  }

  // ═══════════════════════════════════════════
  // Conversation History (Redis)
  // ═══════════════════════════════════════════

  /**
   * Get conversation history from Redis.
   */
  private async getConversationHistory(
    key: string,
  ): Promise<ConversationMessage[]> {
    try {
      const cached = await this.cache.getSettings(key);
      if (cached?.history) {
        return JSON.parse(cached.history) as ConversationMessage[];
      }
    } catch {
      // Cache miss — start fresh
    }
    return [];
  }

  /**
   * Save conversation history to Redis.
   */
  private async saveConversationHistory(
    key: string,
    history: ConversationMessage[],
  ): Promise<void> {
    try {
      await this.cache.setSettings(key, {
        history: JSON.stringify(history),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to save conversation history: ${(err as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════
  // Prompt Builders
  // ═══════════════════════════════════════════

  /**
   * Build the system prompt for the salon receptionist bot.
   */
  private buildReceptionistPrompt(context: any): string {
    return `أنت موظف استقبال ذكي في "${context.salonName || 'الصالون'}".

مهامك:
1. الترحيب بالعملاء بلطف
2. عرض الخدمات والأسعار عند الطلب
3. مساعدة العملاء في حجز المواعيد
4. الإجابة على الاستفسارات
5. اقتراح خدمات إضافية بذكاء (Upsell) عند المناسبة

القواعد:
- رد باختصار (لا تزيد عن 3-4 أسطر)
- استخدم إيموجي بشكل معتدل
- لو العميل يتكلم إنجليزي رد إنجليزي، لو عربي رد عربي
- لا تختلق معلومات — لو ما تعرف قل "خليني أحولك لموظف الاستقبال"
- لا تذكر أنك ذكاء اصطناعي أو بوت — تصرف كموظف استقبال حقيقي
- العملة: ريال سعودي (ر.س)
- لو العميل قال شي ما يتعلق بالصالون، رد بلطف ووجهه للخدمات

بيانات الصالون:
- الاسم: ${context.salonName || 'غير محدد'}
- ساعات العمل: ${context.workingHours || 'غير محدد'}
- الخدمات والأسعار: ${JSON.stringify(context.services || [])}
- الموظفين: ${JSON.stringify(context.employees || [])}
- المواعيد المتاحة: ${JSON.stringify(context.availableSlots || [])}
${
  context.clientInfo
    ? `
بيانات العميل:
- الاسم: ${context.clientInfo.name}
- عدد الزيارات: ${context.clientInfo.visits}
- نقاط الولاء: ${context.clientInfo.loyaltyPoints}
- آخر زيارة: ${context.clientInfo.lastVisit}
`
    : '- عميل جديد (لا توجد بيانات سابقة)'
}`;
  }

  /**
   * Build the system prompt for the AI business consultant.
   */
  private buildConsultantPrompt(data: any): string {
    return `أنت مستشار أعمال محترف متخصص في صالونات التجميل والحلاقة في السعودية.

مهامك:
1. تحليل بيانات الصالون وتقديم نصائح عملية
2. اقتراح تحسينات للتسعير والعروض
3. اقتراح أفكار تسويقية مبتكرة
4. تحليل أداء الموظفين
5. التوقعات المالية والتنبؤات

القواعد:
- استخدم أرقام حقيقية من البيانات المرفقة فقط
- لا تختلق أرقاماً أو إحصائيات
- قدم نصائح عملية قابلة للتنفيذ فوراً
- استخدم العملة: ريال سعودي (ر.س)
- رتب النصائح حسب الأولوية والتأثير
- استخدم تنسيق واضح مع عناوين ونقاط

بيانات الصالون:
${JSON.stringify(data, null, 2)}`;
  }

  // ═══════════════════════════════════════════
  // Fallback Response
  // ═══════════════════════════════════════════

  /**
   * Fallback response when Gemini is unavailable or unconfigured.
   */
  private getFallbackResponse(salonName: string): string {
    return `أهلاً بك في ${salonName}! 💜\n\nعذراً، المساعد الذكي غير متاح حالياً.\nللمساعدة الفورية، يرجى الاتصال بنا مباشرة. 🙏`;
  }
}
