import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../../../shared/resilience/circuit-breaker.service';
import type { SalonContextForAI } from './ai-context.builder';

// ─────────────────── Types ───────────────────

export interface AIReceptionRequest {
  tenantId: string;
  phone: string;
  message: string;
  salonContext: SalonContextForAI;
  history: Array<{ role: 'user' | 'assistant'; text: string; ts: string }>;
  tone: 'formal' | 'friendly';
  systemPrompt?: string;
}

export interface AIReceptionResponse {
  intent: 'inquiry' | 'book' | 'cancel' | 'reschedule' | 'complaint' | 'smalltalk' | 'error';
  reply: string;
  proposedAction: {
    type: 'book_appointment' | 'cancel_appointment' | 'reschedule_appointment';
    payload: Record<string, unknown>;
  } | null;
  success: boolean;
}

/**
 * N8N Client — HTTP client for calling n8n webhooks with circuit breaker.
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
        timeout: 25_000,            // Gemini can take time
        errorThresholdPercentage: 50,
        resetTimeout: 60_000,       // Wait 1 min before retrying after circuit opens
        volumeThreshold: 3,
      },
    );
  }

  /**
   * Call the AI Reception n8n workflow.
   * Returns a structured response from Gemini via n8n.
   * If circuit breaker is open or n8n fails, returns a graceful fallback.
   */
  async callAIReception(payload: AIReceptionRequest): Promise<AIReceptionResponse> {
    try {
      return await this.aiReceptionBreaker.fire(payload);
    } catch (err) {
      this.logger.error(`n8n AI Reception call failed: ${(err as Error).message}`);
      return {
        intent: 'error',
        reply: 'مرحباً! نعتذر عن أي تأخير — يمكنك التواصل مع الصالون مباشرة. 🙏',
        proposedAction: null,
        success: false,
      };
    }
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

    return {
      intent: data.intent || 'inquiry',
      reply: data.reply,
      proposedAction: data.proposedAction || null,
      success: data.success !== false,
    };
  }
}
