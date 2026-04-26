import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { GeminiService, AIReceptionResponse } from './gemini.service';

// ─────────────────── Types ───────────────────

export type AIProviderTier = 'basic' | 'standard' | 'premium';
export type AIProviderComplexity = 'simple' | 'complex';

export type AIProviderMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface AIProviderChatParams {
  messages: AIProviderMessage[];
  complexity: AIProviderComplexity;
  tier: AIProviderTier;
  temperature?: number;
  maxTokens?: number;
  /**
   * Optional context passed to GeminiService fallback so the legacy 5-provider
   * chain can rebuild its prompt if OpenAI is unreachable.
   */
  fallbackContext?: {
    salonContext: any;
    phone: string;
    message: string;
    history: Array<{ role: 'user' | 'assistant'; text: string; ts: string }>;
    tone?: 'formal' | 'friendly' | 'light_gulf' | 'luxury';
    systemPromptOverride?: string;
  };
}

/**
 * Extends the legacy AIReceptionResponse with the V2 JSON envelope described in
 * AI_RECEPTION_V2_PLAN.md §1.5. Optional fields mean responses from older
 * providers (or partial parses) still satisfy the type.
 */
export interface AIProviderResponse extends AIReceptionResponse {
  action?: 'collect_info' | 'submit_booking' | 'escalate' | 'answer_only' | 'cancel' | null;
  extractedData?: {
    serviceName?: string | null;
    date?: string | null;
    time?: string | null;
    customerName?: string | null;
  } | null;
  nextQuestion?: string | null;
  messageType?: 'text' | 'buttons' | 'list' | 'image' | null;
  buttons?: string[] | null;
  needsEscalation?: boolean;
  escalationReason?: string | null;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'angry' | null;
  confidence?: number;
  wantsToCancel?: boolean;
  isNegotiatingPrice?: boolean;
  clientLearnings?: {
    preference?: string | null;
    note?: string | null;
  } | null;
  /** Telemetry: which model produced this response. */
  modelUsed?: string;
}

// ─────────────────── Constants ───────────────────

const GPT_NANO_MODEL = 'gpt-5-nano';
const GPT_MINI_MODEL = 'gpt-5-mini';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_WHISPER_MODEL = 'whisper-large-v3';
const OPENAI_TIMEOUT_MS = 25_000;

/**
 * AI Provider Service — V2 routing layer for the smart receptionist.
 *
 * Selects the right model per (tier × complexity):
 *   - basic   tier  → never reaches here (handled by static replies upstream)
 *   - standard tier → always GPT-5-nano
 *   - premium  tier → GPT-5-mini for complex, GPT-5-nano for simple
 *
 * If OpenAI is unreachable, falls back to GeminiService.receptionChat() which
 * has its own 5-provider chain. Voice transcription routes to Whisper via Groq.
 */
@Injectable()
export class AIProviderService implements OnModuleInit {
  private readonly logger = new Logger(AIProviderService.name);

  private readonly openaiKey: string;
  private readonly groqKey: string;

  private openai: OpenAI | null = null;
  private groq: OpenAI | null = null;

  private openaiBreaker!: CircuitBreaker<[string, AIProviderMessage[], number, number], string | null>;
  private whisperBreaker!: CircuitBreaker<[Buffer, string], string>;

  constructor(
    private readonly config: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly gemini: GeminiService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY', '');
    this.groqKey = this.config.get<string>('GROQ_API_KEY', '');

    if (this.openaiKey) {
      this.openai = new OpenAI({ apiKey: this.openaiKey, timeout: OPENAI_TIMEOUT_MS });
      this.logger.log('🤖 AIProviderService: OpenAI client ready (gpt-5-nano + gpt-5-mini)');
    } else {
      this.logger.warn('⚠️ OPENAI_API_KEY missing — AIProviderService will only use Gemini fallback');
    }

    if (this.groqKey) {
      this.groq = new OpenAI({ apiKey: this.groqKey, baseURL: GROQ_BASE_URL, timeout: OPENAI_TIMEOUT_MS });
      this.logger.log('🎤 AIProviderService: Groq client ready (whisper-large-v3)');
    } else {
      this.logger.warn('⚠️ GROQ_API_KEY missing — voice transcription disabled');
    }
  }

  onModuleInit() {
    this.openaiBreaker = this.circuitBreaker.createBreaker(
      'ai-provider-openai',
      (model: string, messages: AIProviderMessage[], temperature: number, maxTokens: number) =>
        this.callOpenAIRaw(model, messages, temperature, maxTokens),
      { timeout: OPENAI_TIMEOUT_MS + 5_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
    this.openaiBreaker.fallback(() => null);

    this.whisperBreaker = this.circuitBreaker.createBreaker(
      'ai-provider-whisper-groq',
      (audio: Buffer, filename: string) => this.callGroqWhisperRaw(audio, filename),
      { timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
    this.whisperBreaker.fallback(() => '');
  }

  // ═══════════════════════════════════════════
  // Public: chat
  // ═══════════════════════════════════════════

  async chat(params: AIProviderChatParams): Promise<AIProviderResponse> {
    const model = this.selectModel(params.tier, params.complexity);
    const temperature = params.temperature ?? 0.7;
    const maxTokens = params.maxTokens ?? 800;

    if (this.openai) {
      const raw = await this.openaiBreaker.fire(model, params.messages, temperature, maxTokens).catch(() => null);
      if (raw) {
        const parsed = this.parseResponse(raw);
        return { ...parsed, modelUsed: model };
      }
      this.logger.warn(`OpenAI ${model} returned null — falling back to Gemini`);
    }

    return this.geminiFallback(params);
  }

  // ═══════════════════════════════════════════
  // Public: voice transcription
  // ═══════════════════════════════════════════

  async transcribeVoice(audioBuffer: Buffer, filename = 'audio.ogg'): Promise<string> {
    if (!this.groq) {
      this.logger.warn('Voice transcription requested but Groq is not configured');
      return '';
    }
    return this.whisperBreaker.fire(audioBuffer, filename).catch(() => '');
  }

  // ═══════════════════════════════════════════
  // Internals
  // ═══════════════════════════════════════════

  private selectModel(tier: AIProviderTier, complexity: AIProviderComplexity): string {
    if (tier === 'premium' && complexity === 'complex') return GPT_MINI_MODEL;
    return GPT_NANO_MODEL;
  }

  private async callOpenAIRaw(
    model: string,
    messages: AIProviderMessage[],
    temperature: number,
    maxTokens: number,
  ): Promise<string | null> {
    if (!this.openai) return null;
    try {
      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });
      return completion.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      this.logger.error(`OpenAI ${model} call failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async callGroqWhisperRaw(audioBuffer: Buffer, filename: string): Promise<string> {
    if (!this.groq) return '';
    try {
      const file = await OpenAI.toFile(audioBuffer, filename);
      const transcription = await this.groq.audio.transcriptions.create({
        file,
        model: GROQ_WHISPER_MODEL,
        response_format: 'text',
      });
      const text = typeof transcription === 'string' ? transcription : (transcription as { text?: string })?.text || '';
      if (text) {
        this.logger.log(`🎤 Whisper transcribed ${audioBuffer.length}b → "${text.slice(0, 60)}..."`);
      }
      return text;
    } catch (err) {
      this.logger.error(`Groq Whisper failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async geminiFallback(params: AIProviderChatParams): Promise<AIProviderResponse> {
    const ctx = params.fallbackContext;
    if (!ctx) {
      // Reconstruct minimum viable args from messages array.
      const lastUser = [...params.messages].reverse().find((m) => m.role === 'user');
      const systemMsg = params.messages.find((m) => m.role === 'system');
      const history = params.messages
        .filter((m) => m.role !== 'system')
        .slice(0, -1)
        .map((m) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          text: m.content,
          ts: new Date().toISOString(),
        }));
      const fallback = await this.gemini.receptionChat({
        salonContext: {},
        phone: '',
        message: lastUser?.content || '',
        history,
        systemPromptOverride: systemMsg?.content,
      });
      return { ...fallback, modelUsed: 'gemini-fallback' };
    }

    const fallback = await this.gemini.receptionChat({
      salonContext: ctx.salonContext,
      phone: ctx.phone,
      message: ctx.message,
      history: ctx.history,
      tone: ctx.tone,
      systemPromptOverride: ctx.systemPromptOverride,
    });
    return { ...fallback, modelUsed: 'gemini-fallback' };
  }

  /**
   * Parse the V2 JSON envelope from a model response. Tolerant of trailing
   * text or fenced code blocks; falls back to plain reply on failure.
   */
  private parseResponse(raw: string): AIProviderResponse {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const candidate = match ? match[0] : cleaned;

    try {
      const parsed = JSON.parse(candidate);
      const reply = String(parsed.reply ?? '').trim() || raw.trim();
      return {
        intent: parsed.intent || 'general_reply',
        reply,
        proposedAction: parsed.proposedAction || null,
        uncertainReason: parsed.uncertainReason ?? null,
        success: true,
        action: parsed.action ?? null,
        extractedData: parsed.extractedData ?? null,
        nextQuestion: parsed.nextQuestion ?? null,
        messageType: parsed.messageType ?? 'text',
        buttons: Array.isArray(parsed.buttons) ? parsed.buttons : null,
        needsEscalation: Boolean(parsed.needsEscalation),
        escalationReason: parsed.escalationReason ?? null,
        sentiment: parsed.sentiment ?? 'neutral',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        wantsToCancel: Boolean(parsed.wantsToCancel),
        isNegotiatingPrice: Boolean(parsed.isNegotiatingPrice),
        clientLearnings: parsed.clientLearnings ?? null,
      };
    } catch {
      return {
        intent: 'general_reply',
        reply: raw.trim(),
        proposedAction: null,
        uncertainReason: null,
        success: true,
        messageType: 'text',
      };
    }
  }
}
