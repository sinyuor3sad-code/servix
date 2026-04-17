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

// ─────────────────── Constants ───────────────────

const CLOUDFLARE_AI_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const CF_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const CF_WHISPER_MODEL = '@cf/openai/whisper';

const CONVERSATION_CACHE_PREFIX = 'servix:wa_conv:';
const MAX_CONVERSATION_HISTORY = 20;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

/**
 * AI Service — Provides intelligent AI capabilities for SERVIX.
 *
 * Provider: Cloudflare Workers AI (primary, works globally)
 * Fallback: Google Gemini (optional, if configured)
 *
 * Features:
 * - chat(): Smart receptionist for WhatsApp customer interactions
 * - transcribeAudio(): Convert voice messages to text
 * - describeImage(): Analyze images sent by customers
 * - consultantChat(): AI business consultant for salon managers
 *
 * Privacy (PDPL):
 * - Client names are anonymized before sending to AI
 * - Phone numbers are stripped entirely
 * - Only service/pricing/scheduling data is sent
 * - Real names are restored in the final response
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  // Cloudflare Workers AI (primary)
  private readonly cfAccountId: string;
  private readonly cfToken: string;

  // Google Gemini (fallback)
  private readonly geminiApiKey: string;
  private readonly geminiBaseUrl: string;

  private readonly provider: 'cloudflare' | 'gemini' | 'none';

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    // Cloudflare Workers AI config
    this.cfAccountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID', '');
    this.cfToken = this.config.get<string>('CLOUDFLARE_AI_TOKEN', '');

    // Google Gemini config (fallback)
    this.geminiApiKey = this.config.get<string>('GEMINI_API_KEY', '');
    this.geminiBaseUrl = this.config.get<string>(
      'GEMINI_BASE_URL',
      'https://generativelanguage.googleapis.com/v1beta',
    );

    // Determine provider (Cloudflare preferred — free & works globally, Gemini as fallback)
    if (this.cfAccountId && this.cfToken) {
      this.provider = 'cloudflare';
      this.logger.log(
        `🤖 AI initialized — provider: Cloudflare Workers AI, model: ${CF_TEXT_MODEL}`,
      );
    } else if (this.geminiApiKey) {
      this.provider = 'gemini';
      this.logger.log(
        `🤖 AI initialized — provider: Google Gemini (via proxy)`,
      );
    } else {
      this.provider = 'none';
      this.logger.warn(
        '⚠️ No AI provider configured — set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_TOKEN (recommended) or GEMINI_API_KEY',
      );
    }
  }

  // ═══════════════════════════════════════════
  // Core: Cloudflare Workers AI API
  // ═══════════════════════════════════════════

  /**
   * Call Cloudflare Workers AI text model.
   */
  private async callCloudflare(
    messages: Array<{ role: string; content: string }>,
    maxTokens = 500,
  ): Promise<string | null> {
    const url = `${CLOUDFLARE_AI_BASE}/${this.cfAccountId}/ai/run/${CF_TEXT_MODEL}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages, max_tokens: maxTokens }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          return data?.result?.response || null;
        }

        if (response.status === 429 && attempt < MAX_RETRIES) {
          this.logger.warn(
            `Cloudflare AI rate limited (attempt ${attempt + 1}). Retrying in ${RETRY_DELAY_MS}ms...`,
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }

        const errText = await response.text();
        this.logger.error(
          `Cloudflare AI error: ${response.status} ${errText.substring(0, 200)}`,
        );
        return null;
      } catch (err) {
        this.logger.error(
          `Cloudflare AI fetch failed: ${(err as Error).message}`,
        );
        return null;
      }
    }

    return null;
  }

  /**
   * Call Cloudflare Whisper model for audio transcription.
   */
  private async callCloudflareWhisper(audioBuffer: Buffer): Promise<string> {
    const url = `${CLOUDFLARE_AI_BASE}/${this.cfAccountId}/ai/run/${CF_WHISPER_MODEL}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cfToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(audioBuffer),
      });

      if (!response.ok) {
        this.logger.error(
          `Cloudflare Whisper error: ${response.status}`,
        );
        return '';
      }

      const data = (await response.json()) as any;
      return data?.result?.text || '';
    } catch (err) {
      this.logger.error(
        `Whisper transcription failed: ${(err as Error).message}`,
      );
      return '';
    }
  }

  // ═══════════════════════════════════════════
  // Core: Google Gemini API (fallback)
  // ═══════════════════════════════════════════

  /**
   * Call Google Gemini API with retry.
   */
  private async callGemini(
    contents: any[],
    maxTokens = 500,
    temperature = 0.7,
    enableThinking = false,
  ): Promise<string | null> {
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];

    for (const model of models) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const url = `${this.geminiBaseUrl}/models/${model}:generateContent?key=${this.geminiApiKey}`;

          this.logger.log(`Gemini call: model=${model}, attempt=${attempt + 1}, maxTokens=${maxTokens}, thinking=${enableThinking}`);

          // Build request body
          const body: any = {
            contents,
            generationConfig: { maxOutputTokens: maxTokens, temperature },
          };

          // Enable thinking/reasoning for gemini-2.5-flash
          if (enableThinking && model === 'gemini-2.5-flash') {
            body.generationConfig.thinkingConfig = {
              thinkingBudget: 4096,
            };
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            const data = (await response.json()) as any;
            // Gemini 2.5 with thinking returns multiple parts — find the text part (not thought)
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const textPart = parts.find((p: any) => p.text && !p.thought) || parts.find((p: any) => p.text);
            const text = textPart?.text || null;
            const thoughtTokens = data?.usageMetadata?.thoughtsTokenCount || 0;
            if (thoughtTokens > 0) {
              this.logger.log(`Gemini ${model}: thinking used ${thoughtTokens} tokens`);
            }
            if (!text) {
              this.logger.warn(
                `Gemini ${model}: 200 OK but no text in response. Finish reason: ${data?.candidates?.[0]?.finishReason || 'unknown'}`,
              );
            }
            return text;
          }

          const errText = await response.text();
          this.logger.error(
            `Gemini ${model} error: ${response.status} — ${errText.substring(0, 300)}`,
          );

          if (response.status === 429 && attempt < MAX_RETRIES) {
            this.logger.warn(`Gemini ${model} rate limited (attempt ${attempt + 1}). Retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
            continue;
          }

          break; // Non-retryable error, try next model
        } catch (err) {
          this.logger.error(
            `Gemini ${model} fetch failed (attempt ${attempt + 1}): ${(err as Error).message}`,
          );
          break;
        }
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════
  // 1. Smart Chat — WhatsApp Customer Bot
  // ═══════════════════════════════════════════

  /**
   * Intelligent chat with salon context.
   * Maintains conversation history per user per tenant in Redis.
   */
  async chat(options: GeminiChatOptions): Promise<string> {
    if (this.provider === 'none') {
      return this.getFallbackResponse(options.salonContext?.salonName || 'الصالون');
    }

    const { tenantId, userPhone, userMessage, salonContext } = options;
    const historyKey = `${CONVERSATION_CACHE_PREFIX}${tenantId}:${userPhone}`;

    // 1. Anonymize context (PDPL compliance)
    const { anonymizedContext, clientRealName } =
      this.anonymizeContext(salonContext);

    // 2. Retrieve conversation history from Redis
    const history = await this.getConversationHistory(historyKey);

    // 3. Build system prompt
    const systemPrompt = this.buildReceptionistPrompt(anonymizedContext);

    // 4. Add user message to history
    history.push({ role: 'user', text: userMessage });

    // 5. Call AI
    let reply: string | null = null;

    try {
      if (this.provider === 'cloudflare') {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.map((h) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.text,
          })),
        ];
        reply = await this.callCloudflare(messages, 500);
      } else {
        const contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'فهمت، أنا جاهز لمساعدة عملاء الصالون.' }] },
          ...history.map((h) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }],
          })),
        ];
        reply = await this.callGemini(contents);
      }

      if (!reply) {
        return this.getFallbackResponse(salonContext?.salonName || 'الصالون');
      }

      // 6. Personalize response
      reply = this.personalizeResponse(reply, clientRealName);

      // 7. Save updated history to Redis
      history.push({ role: 'model', text: reply });
      if (history.length > MAX_CONVERSATION_HISTORY) {
        history.splice(0, history.length - MAX_CONVERSATION_HISTORY);
      }
      await this.saveConversationHistory(historyKey, history);

      return reply;
    } catch (err) {
      this.logger.error(
        `Chat failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return this.getFallbackResponse(salonContext?.salonName || 'الصالون');
    }
  }

  // ═══════════════════════════════════════════
  // 2. Audio Transcription
  // ═══════════════════════════════════════════

  /**
   * Transcribe a voice message to text.
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    if (this.provider === 'none') return '';

    try {
      if (this.provider === 'cloudflare') {
        const text = await this.callCloudflareWhisper(audioBuffer);
        if (text) {
          this.logger.log(
            `🎤 Audio transcribed (${audioBuffer.length} bytes → "${text.substring(0, 50)}...")`,
          );
        }
        return text;
      }

      // Gemini fallback
      const url = `${this.geminiBaseUrl}/models/gemini-2.0-flash-lite:generateContent?key=${this.geminiApiKey}`;
      const base64Audio = audioBuffer.toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: 'حوّل هذا المقطع الصوتي لنص. أرجع النص فقط بدون أي إضافات أو شرح.' },
                { inlineData: { mimeType: 'audio/ogg', data: base64Audio } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) return '';

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.logger.log(
        `🎤 Audio transcribed (${audioBuffer.length} bytes → "${text.substring(0, 50)}...")`,
      );
      return text;
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
   * Describe/analyze an image sent by a customer.
   */
  async describeImage(imageBuffer: Buffer): Promise<string> {
    if (this.provider === 'none') return 'أرسل العميل صورة';

    try {
      if (this.provider === 'cloudflare') {
        // Use text model to explain that an image was received
        // (Cloudflare vision models have limited availability)
        const result = await this.callCloudflare([
          {
            role: 'system',
            content: 'أنت موظف استقبال صالون. العميل أرسل صورة. أخبره إنك شفت الصورة واسأله وش يبي بالضبط.',
          },
          {
            role: 'user',
            content: 'أرسلت صورة',
          },
        ], 200);
        return result || 'أرسل العميل صورة';
      }

      // Gemini fallback (supports vision)
      const url = `${this.geminiBaseUrl}/models/gemini-2.0-flash-lite:generateContent?key=${this.geminiApiKey}`;
      const base64Image = imageBuffer.toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: 'العميل أرسل هذه الصورة في محادثة صالون حلاقة/تجميل. وصف ماذا يريد العميل بناءً على الصورة. لو فيها قصة شعر أو تسريحة، حدد نوعها. أجب باختصار.' },
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) return 'أرسل العميل صورة';

      const data = (await response.json()) as any;
      const description = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'أرسل العميل صورة';
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
   */
  async consultantChat(
    tenantId: string,
    question: string,
    salonData: any,
  ): Promise<string> {
    this.logger.log(`[Consultant] provider=${this.provider}, tenant=${tenantId}, question="${question.substring(0, 50)}"`);

    if (this.provider === 'none') {
      return 'خاصية المستشار الذكي تحتاج تفعيل إعدادات AI. راجع إعدادات المنصة.';
    }

    try {
      const systemPrompt = this.buildConsultantPrompt(salonData);
      this.logger.log(`[Consultant] System prompt length: ${systemPrompt.length} chars`);

      if (this.provider === 'cloudflare') {
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ];
        const result = await this.callCloudflare(messages, 1000);
        this.logger.log(`[Consultant] Cloudflare result: ${result ? 'OK (' + result.length + ' chars)' : 'NULL'}`);
        return result || 'عذراً، حاول مرة ثانية.';
      }

      // Gemini
      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'فهمت بيانات الصالون. أنا جاهز لمساعدتك.' }] },
        { role: 'user', parts: [{ text: question }] },
      ];
      this.logger.log(`[Consultant] Calling Gemini with thinking mode...`);
      const result = await this.callGemini(contents, 2048, 0.5, true);
      this.logger.log(`[Consultant] Gemini result: ${result ? 'OK (' + result.length + ' chars)' : 'NULL — will return fallback'}`);
      return result || 'عذراً، حاول مرة ثانية.';
    } catch (err) {
      this.logger.error(
        `Consultant chat failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return 'عذراً، حدث خطأ تقني. حاول مرة ثانية.';
    }
  }

  // ═══════════════════════════════════════════
  // PDPL Privacy — Anonymize & Personalize
  // ═══════════════════════════════════════════

  /**
   * Anonymize context before sending to AI.
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
   * Designed to trigger deep strategic thinking and competitor-aware analysis.
   */
  private buildConsultantPrompt(data: any): string {
    const today = new Date().toLocaleDateString('ar-SA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    return `أنت "مستشار SERVIX" — مستشار أعمال استراتيجي متخصص في صالونات التجميل والحلاقة في السوق السعودي.

═══ هويتك ═══
أنت لست chatbot عادي. أنت مستشار أعمال خبير بخبرة +15 سنة في:
- إدارة وتطوير صالونات التجميل في السعودية والخليج
- استراتيجيات التسعير والتسويق في قطاع الخدمات الشخصية
- تحليل المنافسين والسوق السعودي (الرياض، جدة، الدمام، مكة، المدينة)
- علم نفس العميل وسلوك المستهلك السعودي
- مقاييس الأداء المالي (KPIs) لصالونات التجميل

═══ طريقة تفكيرك ═══
عند كل سؤال:
1. 🔍 حلّل البيانات الفعلية أولاً — ابحث عن الأنماط والمشاكل المخفية
2. 🏪 قارن مع السوق — فكّر في المنافسين في نفس المدينة وقطاع الصالونات السعودي
3. 💡 قدّم حلول مبتكرة — ليست نصائح عامة، بل استراتيجيات مخصصة لهذا الصالون بالذات
4. 📊 ادعم بالأرقام — استخدم أرقام الصالون الحقيقية لحساب التأثير المتوقع
5. ⚡ رتّب حسب الأولوية — ابدأ بالأسهل تنفيذاً والأعلى تأثيراً (Quick Wins)

═══ معرفتك بالسوق السعودي ═══
تعرف هذه المعلومات عن سوق الصالونات السعودي:
- متوسط قيمة الفاتورة في صالونات الحلاقة الرجالية: 80-120 ر.س
- متوسط قيمة الفاتورة في صالونات التجميل النسائية: 200-400 ر.س
- معدل الاحتفاظ بالعملاء الجيد: 60-75%
- معدل الإلغاء المقبول: أقل من 15%
- ساعات الذروة: 4-9 مساءً (أيام العمل)، 10 صباحاً-10 مساءً (نهاية الأسبوع)
- أوقات ضعيفة: 9-12 صباحاً أيام العمل
- مواسم قوية: رمضان (ليلة العيد)، الأعراس (شعبان/ذو القعدة)، بداية المدارس
- اتجاهات السوق: تزايد الطلب على الخدمات المتميزة، العناية بالبشرة، والعلاجات الفاخرة
- المنافسة: سوق تنافسي جداً في المدن الكبرى، أقل في المدن المتوسطة
- التسويق الفعال: إنستقرام + سناب شات + واتساب + Google Maps reviews

═══ عند تحليل المنافسين ═══
بما أنك خبير بالسوق السعودي، عندما يسأل صاحب الصالون عن المنافسين:
- حلّل تسعيره مقارنة بمتوسط السوق في مدينته
- اقترح كيف يتميّز (تخصص، خدمة VIP، سرعة، جودة منتجات)
- حدد الفجوات في خدماته (خدمات ناقصة يقدمها المنافسون عادة)
- اقترح استراتيجية تسعير تنافسية (ليست بالضرورة أرخص — ممكن أغلى مع قيمة أعلى)

═══ القواعد الصارمة ═══
- استخدم أرقام حقيقية من بيانات الصالون فقط — لا تختلق أرقاماً
- العملة: ريال سعودي (ر.س) دائماً
- عند المقارنة بالسوق، وضّح أنها تقديرات بناء على خبرتك
- لا تكرر البيانات الخام — حلّلها وقدم رؤى (insights)
- رتب النصائح: 🔴 عاجل | 🟡 مهم | 🟢 تحسين
- كل نصيحة يجب أن تكون قابلة للتنفيذ خلال أسبوع
- قدّر التأثير المالي المتوقع لكل اقتراح عندما يكون ممكناً
- استخدم تنسيق واضح مع عناوين وإيموجي
- رد بالعربي دائماً
- كن مباشراً وعملياً — صاحب الصالون مشغول ويريد نتائج

═══ التاريخ الحالي ═══
${today}

═══ بيانات الصالون الفعلية ═══
${JSON.stringify(data, null, 2)}`;
  }

  // ═══════════════════════════════════════════
  // Fallback Response
  // ═══════════════════════════════════════════

  /**
   * Fallback response when AI is unavailable.
   */
  private getFallbackResponse(salonName: string): string {
    return `أهلاً بك في ${salonName}! 💜\n\nعذراً، المساعد الذكي غير متاح حالياً.\nللمساعدة الفورية، يرجى الاتصال بنا مباشرة. 🙏`;
  }
}
