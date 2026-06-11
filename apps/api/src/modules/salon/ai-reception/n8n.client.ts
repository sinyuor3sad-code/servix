import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../../../shared/resilience/circuit-breaker.service';
import type { AIReceptionResponse } from '../../../shared/ai/gemini.service';
import type { SalonContextForAI } from './ai-context.builder';
import type { AIReceptionTone } from './ai-reception-settings.service';

// ─────────────────── Types ───────────────────

export interface AIReceptionRequest {
  tenantId: string;
  phone: string;
  message: string;
  salonContext: SalonContextForAI;
  history: Array<{ role: 'user' | 'assistant'; text: string; ts: string }>;
  tone: AIReceptionTone;
  systemPrompt?: string;
  promptVersion?: string;
}

/**
 * N8N Client — HTTP client for calling n8n webhooks with circuit breaker.
 *
 * This is the PRIMARY AI path:
 *   API → n8n (5 providers inside: Gemini → Groq → Cloudflare → Cerebras → OpenRouter)
 *
 * If n8n fails entirely, AIReceptionService falls back to GeminiService.receptionChat()
 * which has its own 5-provider fallback chain built in code.
 *
 * Config: `N8N_BASE_URL` (default `http://n8n:5678` in production)
 */
@Injectable()
export class N8nClient implements OnModuleInit {
  private readonly logger = new Logger(N8nClient.name);
  private aiReceptionBreaker!: CircuitBreaker<[AIReceptionRequest], AIReceptionResponse>;

  constructor(
    private readonly config: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  onModuleInit() {
    this.aiReceptionBreaker = this.circuitBreaker.createBreaker(
      'n8n-ai-reception',
      (payload: AIReceptionRequest) => this.callN8nAIReception(payload),
      {
        timeout: 25_000,            // n8n + AI provider can take time
        errorThresholdPercentage: 50,
        resetTimeout: 60_000,       // Wait 1 min before retrying after circuit opens
        volumeThreshold: 3,
      },
    );
  }

  /**
   * Call the AI Reception n8n workflow.
   * Returns a structured AIReceptionResponse.
   * If circuit breaker is open or n8n fails, throws error (caught by AIReceptionService).
   */
  async callAIReception(payload: AIReceptionRequest): Promise<AIReceptionResponse> {
    this.logger.debug(
      `n8n AI reception payload metadata: ${JSON.stringify({
        systemPromptProvided: Boolean(payload.systemPrompt),
        systemPromptLength: payload.systemPrompt?.length ?? 0,
        promptVersion: payload.promptVersion ?? null,
      })}`,
    );
    return this.aiReceptionBreaker.fire(payload);
  }

  private async callN8nAIReception(payload: AIReceptionRequest): Promise<AIReceptionResponse> {
    const baseUrl = this.config.get<string>('N8N_BASE_URL', 'http://n8n:5678');
    const url = `${baseUrl}/webhook/servix-ai-reception`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`n8n returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as AIReceptionResponse;

    // Ensure we have required fields
    if (!data.reply) {
      throw new Error('n8n response missing "reply" field');
    }

    const intent = data.intent || 'inquiry';

    return {
      intent,
      reply: data.reply,
      proposedAction: data.proposedAction || null,
      uncertainReason: data.uncertainReason ?? (intent === 'needs_human' ? 'n8n_needs_human' : null),
      success: data.success !== false,
    };
  }
}
