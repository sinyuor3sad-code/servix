import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../shared/cache/cache.service';
import type { AIProviderResponse } from '../../../shared/ai/ai-provider.service';

// ─────────────────── Types ───────────────────

interface CachedEntry {
  question: string;
  normalized: string;
  tokens: string[];
  reply: string;
  intent: string;
  hitCount: number;
  cachedAt: string;
}

const CACHE_PREFIX = 'servix:ai_cache:';
const TTL_SECONDS = 24 * 60 * 60;
const MAX_ENTRIES = 100;
const SIMILARITY_THRESHOLD = 0.85;
const MIN_QUESTION_TOKENS = 2;

const CACHEABLE_INTENTS = new Set([
  'ask_price',
  'ask_service',
  'general',
  'greeting',
  'inquiry',
  'general_reply',
]);

const ARABIC_STOPWORDS = new Set([
  'في', 'من', 'الى', 'إلى', 'على', 'عن', 'مع', 'هل', 'ما', 'او', 'أو',
  'و', 'ال', 'كم', 'بكم', 'كيف', 'وين', 'ايش', 'ايه', 'انا', 'انت', 'هو',
  'هي', 'يا', 'لو', 'اذا', 'إذا', 'الا', 'إلا', 'كل', 'بعض', 'هذا', 'هذه',
  'ذلك', 'الذي', 'التي', 'الذين',
]);
const ENGLISH_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'do', 'does', 'you', 'i', 'me', 'my',
  'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'how', 'much', 'what',
  'where', 'when', 'why', 'can', 'will',
]);

/**
 * Local semantic cache for the AI reception. Stores recent question/answer
 * pairs per tenant in Redis and reuses an answer when a new question is
 * "similar enough" (Jaccard ≥ 0.85 on stop-word-stripped tokens).
 *
 * No embeddings, no external API — by design. Trades a tiny bit of recall
 * for zero per-call cost and zero added latency.
 */
@Injectable()
export class AISemanticCacheService {
  private readonly logger = new Logger(AISemanticCacheService.name);

  constructor(private readonly cache: CacheService) {}

  // ═══════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════

  async findCachedResponse(
    tenantId: string,
    question: string,
  ): Promise<{ reply: string; intent: string; similarity: number } | null> {
    const tokens = this.tokenize(this.normalizeQuestion(question));
    if (tokens.length < MIN_QUESTION_TOKENS) return null;

    const entries = await this.loadEntries(tenantId);
    if (!entries.length) return null;

    let best: { entry: CachedEntry; score: number } | null = null;
    for (const entry of entries) {
      const score = this.jaccard(tokens, entry.tokens);
      if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
        best = { entry, score };
      }
    }

    if (!best) return null;

    best.entry.hitCount += 1;
    await this.saveEntries(tenantId, entries);

    this.logger.debug(
      `Semantic cache HIT for "${question.slice(0, 40)}" (score=${best.score.toFixed(2)}, hits=${best.entry.hitCount})`,
    );

    return {
      reply: best.entry.reply,
      intent: best.entry.intent,
      similarity: best.score,
    };
  }

  async cacheResponse(
    tenantId: string,
    question: string,
    response: AIProviderResponse,
  ): Promise<void> {
    if (!response.reply || !response.success) return;
    if (!CACHEABLE_INTENTS.has(response.intent)) return;
    if (response.proposedAction || response.action === 'submit_booking') return;
    if (response.needsEscalation || response.action === 'escalate') return;

    const normalized = this.normalizeQuestion(question);
    const tokens = this.tokenize(normalized);
    if (tokens.length < MIN_QUESTION_TOKENS) return;

    const entries = await this.loadEntries(tenantId);

    // If we already cached a near-identical question, just bump hitCount
    // instead of growing the list.
    const existing = entries.find((e) => this.jaccard(tokens, e.tokens) >= SIMILARITY_THRESHOLD);
    if (existing) {
      existing.hitCount += 1;
      existing.reply = response.reply;
      existing.cachedAt = new Date().toISOString();
      await this.saveEntries(tenantId, entries);
      return;
    }

    entries.unshift({
      question,
      normalized,
      tokens,
      reply: response.reply,
      intent: response.intent,
      hitCount: 0,
      cachedAt: new Date().toISOString(),
    });

    // Evict by combining recency with hit-count: keep the top MAX_ENTRIES
    // (recent unshift order already weights recency; sort prefers high-hit).
    const trimmed = entries
      .sort((a, b) => b.hitCount - a.hitCount || b.cachedAt.localeCompare(a.cachedAt))
      .slice(0, MAX_ENTRIES);

    await this.saveEntries(tenantId, trimmed);
  }

  /** Normalize a question for similarity comparison. Public for tests. */
  normalizeQuestion(text: string): string {
    return (text || '')
      .toLowerCase()
      // Strip Arabic diacritics
      .replace(/[ً-ٰٟ]/g, '')
      // Unify Arabic letter variants
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      // Strip emojis and most punctuation, keep letters/digits/spaces
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ═══════════════════════════════════════════
  // Internals
  // ═══════════════════════════════════════════

  private tokenize(normalized: string): string[] {
    if (!normalized) return [];
    return normalized
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .filter((t) => !ARABIC_STOPWORDS.has(t) && !ENGLISH_STOPWORDS.has(t));
  }

  private jaccard(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;
    for (const t of setA) if (setB.has(t)) intersection += 1;
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  private async loadEntries(tenantId: string): Promise<CachedEntry[]> {
    const data = await this.cache.getJson<CachedEntry[]>(this.key(tenantId));
    return Array.isArray(data) ? data : [];
  }

  private async saveEntries(tenantId: string, entries: CachedEntry[]): Promise<void> {
    await this.cache.setJson(this.key(tenantId), entries, TTL_SECONDS);
  }

  private key(tenantId: string): string {
    return `${CACHE_PREFIX}${tenantId}:questions`;
  }
}
