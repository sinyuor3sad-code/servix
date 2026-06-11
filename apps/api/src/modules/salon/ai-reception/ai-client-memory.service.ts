import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../shared/cache/cache.service';
import type { AIProviderResponse } from '../../../shared/ai/ai-provider.service';

// ─────────────────── Types ───────────────────

export type ClientCommunicationStyle = 'brief' | 'detailed' | 'unknown';

export interface ClientMemory {
  phone: string;
  name: string | null;
  preferredServices: string[];
  preferredDay: string | null;
  preferredTime: string | null;
  preferredEmployee: string | null;
  communicationStyle: ClientCommunicationStyle;
  priceSensitive: boolean;
  totalConversations: number;
  totalBookings: number;
  lastVisitDate: string | null;
  lastComplaint: string | null;
  notes: string[];
  updatedAt: string;
}

const MEMORY_PREFIX = 'servix:client_memory:';
const TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_NOTES = 10;
const MAX_PREFERRED_SERVICES = 5;

/**
 * Per-client memory persisted in Redis. Updated incrementally from each
 * AI response and injected back into the prompt as a context block, so the
 * model can address returning customers personally instead of starting
 * cold every conversation.
 */
@Injectable()
export class AIClientMemoryService {
  private readonly logger = new Logger(AIClientMemoryService.name);

  constructor(private readonly cache: CacheService) {}

  // ═══════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════

  async getMemory(tenantId: string, phone: string): Promise<ClientMemory | null> {
    return this.cache.getJson<ClientMemory>(this.key(tenantId, phone));
  }

  async updateMemory(
    tenantId: string,
    phone: string,
    partial: Partial<ClientMemory>,
  ): Promise<ClientMemory> {
    const existing = (await this.getMemory(tenantId, phone)) || this.empty(phone);
    const merged: ClientMemory = {
      ...existing,
      ...partial,
      phone,
      preferredServices: partial.preferredServices
        ? this.dedupCap(partial.preferredServices, MAX_PREFERRED_SERVICES)
        : existing.preferredServices,
      notes: partial.notes
        ? this.dedupCap(partial.notes, MAX_NOTES)
        : existing.notes,
      updatedAt: new Date().toISOString(),
    };
    await this.cache.setJson(this.key(tenantId, phone), merged, TTL_SECONDS);
    return merged;
  }

  /**
   * Folds a single AI turn into the memory record. Updates name/intent/notes
   * and bumps counters. Always increments `totalConversations` so we know
   * how many turns we've had with this customer.
   */
  async updateFromAIResponse(
    tenantId: string,
    phone: string,
    aiResponse: AIProviderResponse,
  ): Promise<ClientMemory> {
    const existing = (await this.getMemory(tenantId, phone)) || this.empty(phone);

    const next: ClientMemory = {
      ...existing,
      totalConversations: existing.totalConversations + 1,
      updatedAt: new Date().toISOString(),
    };

    if (aiResponse.extractedData?.customerName) {
      next.name = aiResponse.extractedData.customerName;
    }
    if (aiResponse.extractedData?.serviceName) {
      next.preferredServices = this.dedupCap(
        [aiResponse.extractedData.serviceName, ...existing.preferredServices],
        MAX_PREFERRED_SERVICES,
      );
    }
    if (aiResponse.extractedData?.date) {
      next.preferredDay = aiResponse.extractedData.date;
    }
    if (aiResponse.extractedData?.time) {
      next.preferredTime = aiResponse.extractedData.time;
    }

    if (aiResponse.action === 'submit_booking') {
      next.totalBookings = existing.totalBookings + 1;
      next.lastVisitDate = new Date().toISOString();
    }

    if (aiResponse.isNegotiatingPrice) {
      next.priceSensitive = true;
    }

    if (aiResponse.intent === 'complaint' || aiResponse.sentiment === 'angry') {
      next.lastComplaint = aiResponse.reply.slice(0, 200);
    }

    if (aiResponse.clientLearnings?.preference) {
      const pref = aiResponse.clientLearnings.preference;
      if (pref === 'prefers_brief' || pref === 'brief') next.communicationStyle = 'brief';
      else if (pref === 'prefers_detailed' || pref === 'detailed') next.communicationStyle = 'detailed';
    }

    if (aiResponse.clientLearnings?.note) {
      next.notes = this.dedupCap(
        [aiResponse.clientLearnings.note, ...existing.notes],
        MAX_NOTES,
      );
    }

    await this.cache.setJson(this.key(tenantId, phone), next, TTL_SECONDS);
    return next;
  }

  /**
   * Render the memory as an Arabic context block for the AI prompt. Returns
   * a friendly "new customer" line when there's no memory yet, so the
   * caller can drop the result straight into the prompt unconditionally.
   */
  async buildMemoryContext(tenantId: string, phone: string): Promise<string> {
    const memory = await this.getMemory(tenantId, phone);
    if (!memory) {
      return 'عميل جديد، لا توجد معلومات سابقة.';
    }

    const lines: string[] = [];
    if (memory.name) lines.push(`- الاسم: ${memory.name}`);

    if (memory.totalBookings > 0) {
      lines.push(`- عميل متكرر (${memory.totalBookings} حجز سابق، ${memory.totalConversations} محادثة)`);
    } else if (memory.totalConversations > 1) {
      lines.push(`- تواصل سابقاً (${memory.totalConversations} محادثة، بدون حجز بعد)`);
    }

    if (memory.preferredServices.length > 0) {
      const services = memory.preferredServices.slice(0, 3).join('، ');
      const day = memory.preferredDay ? ` ${memory.preferredDay}` : '';
      const time = memory.preferredTime ? ` ${memory.preferredTime}` : '';
      const when = day || time ? `،${day}${time}` : '';
      lines.push(`- يحجز عادة: ${services}${when}`);
    }

    if (memory.preferredEmployee) {
      lines.push(`- الموظفة المفضلة: ${memory.preferredEmployee}`);
    }

    if (memory.communicationStyle === 'brief') {
      lines.push('- يفضل ردوداً قصيرة جداً');
    } else if (memory.communicationStyle === 'detailed') {
      lines.push('- يحب التفاصيل الكاملة');
    }

    if (memory.priceSensitive) {
      lines.push('- حساس للأسعار — اذكر القيمة مع السعر');
    }

    if (memory.lastComplaint) {
      lines.push(`- ملاحظة سابقة: ${memory.lastComplaint.slice(0, 80)}`);
    }

    for (const note of memory.notes.slice(0, 3)) {
      lines.push(`- ${note}`);
    }

    if (lines.length === 0) {
      return 'عميل معروف، لا توجد تفضيلات محفوظة بعد.';
    }
    return ['معلومات عن العميل:', ...lines].join('\n');
  }

  // ═══════════════════════════════════════════
  // Internals
  // ═══════════════════════════════════════════

  private key(tenantId: string, phone: string): string {
    return `${MEMORY_PREFIX}${tenantId}:${this.normalizePhone(phone)}`;
  }

  private empty(phone: string): ClientMemory {
    return {
      phone,
      name: null,
      preferredServices: [],
      preferredDay: null,
      preferredTime: null,
      preferredEmployee: null,
      communicationStyle: 'unknown',
      priceSensitive: false,
      totalConversations: 0,
      totalBookings: 0,
      lastVisitDate: null,
      lastComplaint: null,
      notes: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private dedupCap(items: string[], cap: number): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
      const trimmed = (item ?? '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
      if (out.length >= cap) break;
    }
    return out;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }
}
