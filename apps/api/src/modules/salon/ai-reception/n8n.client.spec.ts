import type { ConfigService } from '@nestjs/config';
import type { CircuitBreakerService } from '../../../shared/resilience/circuit-breaker.service';
import { N8nClient } from './n8n.client';

type Mock = jest.Mock;

function makeConfig(): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'N8N_BASE_URL') return 'http://n8n.test';
      return fallback;
    }),
  } as unknown as ConfigService;
}

function makeCircuitBreaker(): CircuitBreakerService {
  return {
    createBreaker: <TArgs extends unknown[], TResult>(
      _name: string,
      fn: (...args: TArgs) => Promise<TResult>,
    ) => ({
      fire: (...args: TArgs) => fn(...args),
    }),
  } as unknown as CircuitBreakerService;
}

const originalFetch = global.fetch;

describe('N8nClient', () => {
  let client: N8nClient;

  beforeEach(() => {
    client = new N8nClient(makeConfig(), makeCircuitBreaker());
    client.onModuleInit();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        intent: 'inquiry',
        reply: 'ok',
        proposedAction: null,
        success: true,
      }),
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('sends systemPrompt in the n8n webhook body without requiring workflow changes', async () => {
    await client.callAIReception({
      tenantId: 'tenant-1',
      phone: '966500000000',
      message: 'ابي حجز',
      salonContext: {
        salonName: 'Salon',
        employeeName: 'Sara',
        workingHours: '10:00-22:00',
        workingDays: {},
        services: [{ name: 'قص وتصفيف', price: 80, duration: 60, category: 'hair' }],
        employees: [],
        policies: { cancellationNotice: '24h', currency: 'SAR', taxPercentage: 15 },
        knowledgeSnippets: [],
      },
      history: [],
      tone: 'friendly',
      systemPrompt: 'safe system prompt',
      promptVersion: 'phase-2',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { systemPrompt?: string; promptVersion?: string };

    expect(body.systemPrompt).toBe('safe system prompt');
    expect(body.promptVersion).toBe('phase-2');
  });
});
