import { Injectable, Logger } from '@nestjs/common';
import type { SalonContextForAI } from './ai-context.builder';
import type { AIReceptionRuntimeSettings } from './ai-reception-settings.service';

export interface SafetyNetContext {
  services: SalonContextForAI['services'];
  settings: AIReceptionRuntimeSettings;
  /** Optional reply to substitute when premature confirmation is detected. */
  prematureReplacement?: string;
  /** Optional max-line cap (default 3). */
  maxLines?: number;
  /** Optional max-emoji cap (default 1). */
  maxEmojis?: number;
}

export interface SafetyNetResult {
  reply: string;
  blockedConfirmation: boolean;
  pricesAdjusted: boolean;
  identityRedactions: number;
  truncated: boolean;
  emojiTruncated: boolean;
}

const DEFAULT_PREMATURE_REPLACEMENT =
  'وصل طلبك، بانتظار تأكيد الصالون. بنرسل لك التأكيد النهائي هنا.';

const PREMATURE_CONFIRMATION_PATTERNS: RegExp[] = [
  /تم\s+الحجز/i,
  /تم\s+حجزك/i,
  /تم\s+تاكيد\s+حجزك/i,
  /تم\s+تأكيد\s+حجزك/i,
  /حجزك\s+مؤكد/i,
  /موعدك\s+مؤكد/i,
  /اب?شر[يى]\s+تم/i,
  /خلاص\s+حجزتك/i,
  /تم\s+تسجيلك/i,
  /booking\s+confirmed/i,
];

const AI_IDENTITY_PATTERNS: RegExp[] = [
  /كذكاء\s*اصطناعي/gi,
  /كذكاء\s*اصطناعى/gi,
  /كروبوت/gi,
  /انا\s*بوت/gi,
  /أنا\s*بوت/gi,
  /انا\s*روبوت/gi,
  /أنا\s*روبوت/gi,
  /بصفتي\s*مساعد(ة|اً|ا)?\s*رقمي(ة)?/gi,
  /بصفتي\s*ذكاء\s*اصطناعي/gi,
  /\bI'?m\s+an?\s+(AI|bot|assistant)\b/gi,
  /\bas\s+an?\s+(AI|language\s+model|assistant)\b/gi,
  /\blanguage\s+model\b/gi,
  /\bChatGPT\b/gi,
  /\bGPT[-\s]?\d+/gi,
  /\bGemini\b/gi,
];

const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{2700}-\u{27BF}]/gu;

/**
 * AI Safety Net — last-line filter on every model reply before it goes out.
 *
 * Each `sanitize` call runs six independent guards (prices, premature
 * confirmation, AI identity, avoided phrases, line cap, emoji cap) and
 * reports back which fired so callers can log/telemetry.
 */
@Injectable()
export class AISafetyNetService {
  private readonly logger = new Logger(AISafetyNetService.name);

  sanitize(reply: string, context: SafetyNetContext): SafetyNetResult {
    let working = reply ?? '';

    const { reply: priceFixed, adjusted } = this.validatePrices(working, context.services);
    working = priceFixed;

    const { reply: confirmationGuarded, blocked } = this.blockPrematureConfirmation(
      working,
      context.prematureReplacement || DEFAULT_PREMATURE_REPLACEMENT,
    );
    working = confirmationGuarded;

    const { reply: identityScrubbed, redactions } = this.removeAIIdentityLeaks(working);
    working = identityScrubbed;

    working = this.applyAvoidedPhrases(working, context.settings.avoidedPhrases);

    const { reply: capped, truncated } = this.truncateIfNeeded(working, context.maxLines ?? 3);
    working = capped;

    const { reply: emojiCapped, truncated: emojiTruncated } = this.limitEmojis(
      working,
      context.maxEmojis ?? 1,
    );
    working = emojiCapped;

    if (blocked || adjusted || redactions > 0 || truncated || emojiTruncated) {
      this.logger.debug(
        `Safety net adjustments — blockedConfirmation=${blocked} pricesAdjusted=${adjusted} ` +
          `identityRedactions=${redactions} truncated=${truncated} emojiTruncated=${emojiTruncated}`,
      );
    }

    return {
      reply: working.trim(),
      blockedConfirmation: blocked,
      pricesAdjusted: adjusted,
      identityRedactions: redactions,
      truncated,
      emojiTruncated,
    };
  }

  // ─────────────── 1. validatePrices ───────────────

  validatePrices(
    reply: string,
    services: SalonContextForAI['services'],
  ): { reply: string; adjusted: boolean } {
    if (!reply || services.length === 0) return { reply, adjusted: false };

    let adjusted = false;
    let working = reply;

    for (const service of services) {
      if (!service.name || !Number.isFinite(service.price)) continue;
      const escapedName = this.escapeRegExp(service.name);
      // Match: "<service> ... <number> ر.س" within a short window.
      const pattern = new RegExp(
        `(${escapedName}[^\\d\\n]{0,40})(\\d+(?:[.,]\\d+)?)(\\s*(?:ر\\.?\\s*س|ريال|SAR))?`,
        'gi',
      );
      working = working.replace(pattern, (match, prefix: string, num: string, suffix: string) => {
        const numeric = Number(num.replace(',', '.'));
        if (!Number.isFinite(numeric)) return match;
        if (Math.abs(numeric - service.price) < 0.01) return match;
        adjusted = true;
        const officialPrice = Number.isInteger(service.price)
          ? String(service.price)
          : service.price.toFixed(2);
        return `${prefix}${officialPrice}${suffix || ' ر.س'}`;
      });
    }

    return { reply: working, adjusted };
  }

  // ─────────────── 2. blockPrematureConfirmation ───────────────

  blockPrematureConfirmation(
    reply: string,
    replacement: string,
  ): { reply: string; blocked: boolean } {
    if (!reply) return { reply, blocked: false };
    const blocked = PREMATURE_CONFIRMATION_PATTERNS.some((re) => re.test(reply));
    return blocked ? { reply: replacement, blocked: true } : { reply, blocked: false };
  }

  // ─────────────── 3. removeAIIdentityLeaks ───────────────

  removeAIIdentityLeaks(reply: string): { reply: string; redactions: number } {
    if (!reply) return { reply, redactions: 0 };
    let redactions = 0;
    let working = reply;
    for (const pattern of AI_IDENTITY_PATTERNS) {
      working = working.replace(pattern, () => {
        redactions += 1;
        return '';
      });
    }
    return { reply: working.replace(/\s{2,}/g, ' ').trim(), redactions };
  }

  // ─────────────── 4. applyAvoidedPhrases ───────────────

  applyAvoidedPhrases(reply: string, avoided: string[]): string {
    if (!reply || avoided.length === 0) return reply;
    let working = reply;
    for (const phrase of avoided) {
      const trimmed = phrase.trim();
      if (!trimmed) continue;
      working = working.replace(new RegExp(this.escapeRegExp(trimmed), 'gi'), 'حياك الله');
    }
    return working.replace(/\s{2,}/g, ' ').trim();
  }

  // ─────────────── 5. truncateIfNeeded ───────────────

  truncateIfNeeded(reply: string, maxLines: number): { reply: string; truncated: boolean } {
    if (!reply) return { reply, truncated: false };
    const lines = reply.split(/\r?\n/);
    if (lines.length <= maxLines) return { reply, truncated: false };
    return { reply: lines.slice(0, maxLines).join('\n'), truncated: true };
  }

  // ─────────────── 6. limitEmojis ───────────────

  limitEmojis(reply: string, maxEmojis: number): { reply: string; truncated: boolean } {
    if (!reply) return { reply, truncated: false };
    let kept = 0;
    let truncated = false;
    const result = reply.replace(EMOJI_REGEX, (match) => {
      if (kept < maxEmojis) {
        kept += 1;
        return match;
      }
      truncated = true;
      return '';
    });
    return { reply: result.replace(/\s{2,}/g, ' ').trim(), truncated };
  }

  // ─────────────── helpers ───────────────

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
