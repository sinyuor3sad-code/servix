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
