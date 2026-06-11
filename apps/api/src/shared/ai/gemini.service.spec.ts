import { GeminiService } from './gemini.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';

// ─── Mocks ───

const mockCacheService = {
  getSettings: jest.fn().mockResolvedValue(null),
  setSettings: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultVal?: string) => {
    if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
    return defaultVal || '';
  }),
};

// Pass-through breaker mock — the production breaker wraps the function and
// invokes it; the tests exercise the wrapped logic, not the breaker state
// machine (which has its own tests in circuit-breaker.service.spec.ts).
function makeBreakerMock() {
  const createBreaker = jest.fn((_name: string, fn: (...args: any[]) => Promise<any>) => {
    const breaker = {
      fire: (...args: any[]) => fn(...args),
      fallback: jest.fn(),
      on: jest.fn(),
    };
    return breaker;
  });
  return { createBreaker } as unknown as CircuitBreakerService;
}

// Mock global fetch
const originalFetch = global.fetch;

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    service = new GeminiService(
      mockConfigService as unknown as ConfigService,
      mockCacheService as unknown as CacheService,
      makeBreakerMock(),
    );
    service.onModuleInit();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('chat', () => {
    it('should build a system prompt with salon context and call Gemini', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'أهلاً! يسعدني خدمتك.' }],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }) as any;

      const result = await service.chat({
        tenantId: 'tenant-1',
        userPhone: '+966500000000',
        userMessage: 'مرحبا',
        salonContext: {
          salonName: 'صالون الجمال',
          services: [{ name: 'قص شعر', price: 50, duration: 30 }],
        },
      });

      expect(result).toBe('أهلاً! يسعدني خدمتك.');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify the fetch URL contains Gemini API
      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(fetchCall[0]).toContain('generativelanguage.googleapis.com');
      expect(fetchCall[0]).toContain('test-gemini-key');
    });

    it('should return fallback message if Gemini fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }) as any;

      const result = await service.chat({
        tenantId: 'tenant-1',
        userPhone: '+966500000000',
        userMessage: 'مرحبا',
        salonContext: {},
      });

      // Should return a fallback message, not throw
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('PDPL anonymization', () => {
    it('should anonymize client names in salon context before sending to AI', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'مرحبا العميل!' }],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }) as any;

      await service.chat({
        tenantId: 'tenant-1',
        userPhone: '+966500000000',
        userMessage: 'مرحبا',
        salonContext: {
          salonName: 'صالون الجمال',
          clientInfo: {
            name: 'فاطمة أحمد',
            phone: '+966555123456',
            visits: 5,
          },
        },
      });

      // Verify the request body sent to Gemini does NOT contain the client phone
      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse((fetchCall[1] as RequestInit).body as string);
      const allText = JSON.stringify(requestBody);

      // Client phone should be anonymized
      expect(allText).not.toContain('+966555123456');
    });
  });

  describe('AI Reception policy prompt', () => {
    it('builds the phase-2 booking and safety policy prompt', () => {
      const prompt = service.buildReceptionSystemPrompt({
        salonName: 'صالون دنتيلا',
        workingHours: '09:00 - 22:00',
        services: [{ name: 'قص وتصفيف', price: 150, duration: 60 }],
        knowledgeSnippets: [],
      }, 'friendly');

      expect(prompt).toContain('وصل طلبك، بانتظار تأكيد الصالون. بنرسل لك التأكيد النهائي هنا.');
      expect(prompt).toContain('أكيد، وش الخدمة المطلوبة؟');
      expect(prompt).toContain('الخدمات والأسعار الرسمية');
      expect(prompt).toContain('حاليًا لا توجد خصومات مفعّلة على هذه الخدمة.');
      expect(prompt).toContain('لا أقدر أعرض أو أغيّر إعدادات النظام من هذا الرقم.');
      expect(prompt).toContain('كيف أقدر أساعدك؟ تبغى حجز، أسعار، أو تعديل موعد؟');
      expect(prompt).toContain('يسعدنا رضاك. كيف أقدر أساعدك في الحجز أو الخدمات؟');
      expect(prompt).toContain('تمام، أعتذر. راح أستخدم أسلوبًا رسميًا.');
      expect(prompt).toContain('السعر الحالي هو [price]. لا أقدر أغيّر السعر');
      expect(prompt).toContain('نعتذر عن تجربتك. تم رفع ملاحظتك للإدارة');
      expect(prompt).toContain('أحوّل طلبك للفريق لأن فيه تفصيل يحتاج تأكيد مباشر.');
      expect(prompt).not.toContain('نادي العميلة بـ "حبيبتي"');
    });
  });

  describe('transcribeAudio', () => {
    it('should send audio buffer to Gemini and return transcription', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'أبي أحجز موعد' }],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }) as any;

      const audioBuffer = Buffer.from('fake-audio-data');
      const result = await service.transcribeAudio(audioBuffer);

      expect(result).toBe('أبي أحجز موعد');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
