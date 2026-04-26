import { AISemanticCacheService } from './ai-semantic-cache.service';
import type { CacheService } from '../../../shared/cache/cache.service';
import type { AIProviderResponse } from '../../../shared/ai/ai-provider.service';

function makeCache() {
  let store: unknown = null;
  return {
    cache: {
      getJson: jest.fn().mockImplementation(async () => store),
      setJson: jest.fn().mockImplementation(async (_key: string, value: unknown) => {
        store = value;
      }),
      deleteKey: jest.fn(),
      incrementInt: jest.fn(),
    } as unknown as CacheService,
    getStore: () => store as Array<Record<string, unknown>> | null,
  };
}

function aiResponse(overrides: Partial<AIProviderResponse> = {}): AIProviderResponse {
  return {
    intent: 'ask_price',
    reply: 'سعر القص 80 ريال',
    proposedAction: null,
    success: true,
    action: 'answer_only',
    needsEscalation: false,
    ...overrides,
  };
}

describe('AISemanticCacheService', () => {
  describe('findCachedResponse', () => {
    it('returns null when nothing is cached', async () => {
      const { cache } = makeCache();
      const svc = new AISemanticCacheService(cache);
      const result = await svc.findCachedResponse('tenant-1', 'كم سعر القص؟');
      expect(result).toBeNull();
    });

    it('returns the cached entry when a similar question is asked', async () => {
      const { cache } = makeCache();
      const svc = new AISemanticCacheService(cache);

      await svc.cacheResponse('tenant-1', 'كم سعر القص؟', aiResponse());
      const hit = await svc.findCachedResponse('tenant-1', 'كم سعر القص');

      expect(hit).not.toBeNull();
      expect(hit?.reply).toBe('سعر القص 80 ريال');
      expect(hit?.similarity).toBeGreaterThanOrEqual(0.85);
    });

    it('misses when the question is fundamentally different', async () => {
      const { cache } = makeCache();
      const svc = new AISemanticCacheService(cache);

      await svc.cacheResponse('tenant-1', 'كم سعر القص؟', aiResponse());
      const miss = await svc.findCachedResponse('tenant-1', 'وين موقعكم؟');

      expect(miss).toBeNull();
    });

    it('rejects very short queries (< 2 meaningful tokens)', async () => {
      const { cache } = makeCache();
      const svc = new AISemanticCacheService(cache);

      await svc.cacheResponse('tenant-1', 'كم سعر القص؟', aiResponse());
      const miss = await svc.findCachedResponse('tenant-1', 'هلا');

      expect(miss).toBeNull();
    });
  });

  describe('cacheResponse', () => {
    it('refuses to cache submit_booking responses (per-customer state)', async () => {
      const { cache, getStore } = makeCache();
      const svc = new AISemanticCacheService(cache);

      await svc.cacheResponse('tenant-1', 'احجز لي بكرة 5 مساء قص', aiResponse({
        intent: 'book_appointment',
        action: 'submit_booking',
        proposedAction: { type: 'book_appointment', payload: {} },
      }));

      expect(getStore()).toBeNull();
    });

    it('refuses to cache escalation responses', async () => {
      const { cache, getStore } = makeCache();
      const svc = new AISemanticCacheService(cache);

      await svc.cacheResponse('tenant-1', 'عندي شكوى', aiResponse({
        intent: 'complaint',
        needsEscalation: true,
      }));

      expect(getStore()).toBeNull();
    });

    it('refuses to cache failed responses', async () => {
      const { cache, getStore } = makeCache();
      const svc = new AISemanticCacheService(cache);

      await svc.cacheResponse('tenant-1', 'كم سعر القص؟', aiResponse({ success: false }));

      expect(getStore()).toBeNull();
    });

    it('caps the store at 100 entries (eviction by recency + hit count)', async () => {
      const { cache, getStore } = makeCache();
      const svc = new AISemanticCacheService(cache);

      for (let i = 0; i < 110; i++) {
        await svc.cacheResponse('tenant-1', `سؤال رقم ${i} عن خدمة الصالون`, aiResponse({
          reply: `رد ${i}`,
        }));
      }

      const store = getStore() || [];
      expect(store.length).toBeLessThanOrEqual(100);
    });

    it('bumps hitCount instead of growing the list when an equivalent question recurs', async () => {
      const { cache, getStore } = makeCache();
      const svc = new AISemanticCacheService(cache);

      await svc.cacheResponse('tenant-1', 'كم سعر القص؟', aiResponse());
      await svc.cacheResponse('tenant-1', 'كم سعر القص', aiResponse());

      const store = getStore() || [];
      expect(store).toHaveLength(1);
      expect((store[0] as { hitCount: number }).hitCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('normalizeQuestion', () => {
    const svc = new AISemanticCacheService(makeCache().cache);

    it('strips diacritics, emoji, and unifies letter variants', () => {
      const out = svc.normalizeQuestion('كَمْ سِعْر القُصّ؟ 😊');
      expect(out).not.toMatch(/[ًٌٍَُِّْ]/);
      expect(out).not.toContain('😊');
      expect(out).not.toContain('؟');
    });

    it('treats أ/إ/آ as ا and ة as ه', () => {
      const out = svc.normalizeQuestion('أبغى صبغة');
      expect(out).toContain('ابغي'); // ى→ي is also part of normalization
      expect(out).toContain('صبغه');
    });
  });
});
