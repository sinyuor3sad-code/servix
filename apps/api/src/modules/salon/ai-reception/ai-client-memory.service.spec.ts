import { AIClientMemoryService } from './ai-client-memory.service';
import type { CacheService } from '../../../shared/cache/cache.service';
import type { AIProviderResponse } from '../../../shared/ai/ai-provider.service';

function makeCache() {
  const store = new Map<string, unknown>();
  return {
    cache: {
      getJson: jest.fn().mockImplementation(async (key: string) => store.get(key) ?? null),
      setJson: jest.fn().mockImplementation(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      deleteKey: jest.fn().mockImplementation(async (key: string) => store.delete(key)),
      incrementInt: jest.fn(),
    } as unknown as CacheService,
    store,
  };
}

function aiResponse(overrides: Partial<AIProviderResponse> = {}): AIProviderResponse {
  return {
    intent: 'general_reply',
    reply: 'حياك الله',
    proposedAction: null,
    success: true,
    action: 'answer_only',
    needsEscalation: false,
    ...overrides,
  };
}

describe('AIClientMemoryService', () => {
  describe('getMemory', () => {
    it('returns null for an unknown client', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);
      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m).toBeNull();
    });
  });

  describe('updateFromAIResponse', () => {
    it('captures the customer name when extractedData provides one', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      const updated = await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse({
        extractedData: { customerName: 'سارة', serviceName: null, date: null, time: null },
      }));

      expect(updated.name).toBe('سارة');
    });

    it('appends preferred services without exceeding the cap', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      for (const s of ['قص', 'صبغة', 'بروتين', 'منيكير', 'مساج', 'حنة', 'بدكير']) {
        await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse({
          extractedData: { serviceName: s, customerName: null, date: null, time: null },
        }));
      }

      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m?.preferredServices.length).toBeLessThanOrEqual(5);
      // Most recent service is unshifted to the front.
      expect(m?.preferredServices[0]).toBe('بدكير');
    });

    it('increments totalConversations on every turn', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse());
      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse());
      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse());

      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m?.totalConversations).toBe(3);
    });

    it('increments totalBookings only on submit_booking', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse());
      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse({
        action: 'submit_booking',
      }));

      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m?.totalBookings).toBe(1);
      expect(m?.lastVisitDate).not.toBeNull();
    });

    it('marks the client price-sensitive on negotiation', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse({
        isNegotiatingPrice: true,
      }));

      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m?.priceSensitive).toBe(true);
    });

    it('captures the last complaint when sentiment is angry', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse({
        intent: 'complaint',
        sentiment: 'angry',
        reply: 'نعتذر عن تجربتك السيئة',
      }));

      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m?.lastComplaint).toContain('نعتذر');
    });

    it('records communication style preference from clientLearnings', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      await svc.updateFromAIResponse('tenant-1', '966500000000', aiResponse({
        clientLearnings: { preference: 'prefers_brief', note: null },
      }));

      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m?.communicationStyle).toBe('brief');
    });
  });

  describe('updateMemory', () => {
    it('merges partial updates without losing existing fields', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      await svc.updateMemory('tenant-1', '966500000000', { name: 'سارة' });
      await svc.updateMemory('tenant-1', '966500000000', { preferredEmployee: 'نورة' });

      const m = await svc.getMemory('tenant-1', '966500000000');
      expect(m?.name).toBe('سارة');
      expect(m?.preferredEmployee).toBe('نورة');
    });
  });

  describe('buildMemoryContext', () => {
    it('returns the new-customer line when no memory exists', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      const ctx = await svc.buildMemoryContext('tenant-1', '966500000000');
      expect(ctx).toContain('عميل جديد');
    });

    it('renders a friendly summary for repeat customers', async () => {
      const { cache } = makeCache();
      const svc = new AIClientMemoryService(cache);

      await svc.updateMemory('tenant-1', '966500000000', {
        name: 'سارة',
        totalBookings: 5,
        totalConversations: 8,
        preferredServices: ['صبغة', 'قص'],
        preferredDay: 'الخميس',
        preferredTime: '5 مساء',
        priceSensitive: true,
      });

      const ctx = await svc.buildMemoryContext('tenant-1', '966500000000');
      expect(ctx).toContain('سارة');
      expect(ctx).toContain('5 حجز');
      expect(ctx).toContain('صبغة');
      expect(ctx).toContain('حساس للأسعار');
    });
  });
});
