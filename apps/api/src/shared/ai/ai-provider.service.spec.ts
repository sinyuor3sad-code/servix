import type { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { AIProviderService } from './ai-provider.service';
import type { GeminiService, AIReceptionResponse } from './gemini.service';

jest.mock('openai', () => {
  const create = jest.fn();
  // OpenAI exports the class as default; we also need OpenAI.toFile.
  class FakeOpenAI {
    chat = { completions: { create } };
    audio = { transcriptions: { create: jest.fn() } };
  }
  (FakeOpenAI as any).toFile = jest.fn();
  // Expose the spy so tests can set return values.
  (FakeOpenAI as any).__create = create;
  return { __esModule: true, default: FakeOpenAI };
});

const OpenAIModule = require('openai');
const openAICreateMock: jest.Mock = OpenAIModule.default.__create;

class StubMetricsService {
  circuitState = { set: jest.fn() };
  circuitFallbacks = { inc: jest.fn() };
}

function makeService(opts: {
  openaiKey?: string;
  groqKey?: string;
  gemini?: Partial<GeminiService>;
} = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'OPENAI_API_KEY') return opts.openaiKey ?? 'sk-test';
      if (key === 'GROQ_API_KEY') return opts.groqKey ?? 'gsk-test';
      return fallback ?? '';
    }),
  } as unknown as ConfigService;

  const gemini = {
    receptionChat: jest.fn().mockResolvedValue({
      intent: 'general_reply',
      reply: 'Gemini fallback reply',
      proposedAction: null,
      success: true,
    } as AIReceptionResponse),
    ...opts.gemini,
  } as unknown as GeminiService;

  const breakers = new CircuitBreakerService(new StubMetricsService() as never);
  const service = new AIProviderService(config, breakers, gemini);
  // CircuitBreakerService.onModuleInit only logs; the real per-breaker setup
  // happens in AIProviderService.onModuleInit.
  service.onModuleInit();
  return { service, gemini, openAICreateMock };
}

beforeEach(() => {
  openAICreateMock.mockReset();
});

describe('AIProviderService — tier-based model selection', () => {
  function makeJsonReply(reply = '{"reply":"hi","intent":"greeting","action":"answer_only"}') {
    return { choices: [{ message: { content: reply } }] };
  }

  it('uses gpt-5-nano for standard tier (any complexity)', async () => {
    const { service } = makeService();
    openAICreateMock.mockResolvedValue(makeJsonReply());

    await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      complexity: 'complex',
      tier: 'standard',
    });

    expect(openAICreateMock).toHaveBeenCalledTimes(1);
    expect(openAICreateMock.mock.calls[0][0].model).toBe('gpt-5-nano');
  });

  it('uses gpt-5-nano for premium + simple', async () => {
    const { service } = makeService();
    openAICreateMock.mockResolvedValue(makeJsonReply());

    await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      complexity: 'simple',
      tier: 'premium',
    });

    expect(openAICreateMock.mock.calls[0][0].model).toBe('gpt-5-nano');
  });

  it('uses gpt-5-mini for premium + complex', async () => {
    const { service } = makeService();
    openAICreateMock.mockResolvedValue(makeJsonReply());

    await service.chat({
      messages: [{ role: 'user', content: 'long' }],
      complexity: 'complex',
      tier: 'premium',
    });

    expect(openAICreateMock.mock.calls[0][0].model).toBe('gpt-5-mini');
  });

  it('reports the chosen model on the response', async () => {
    const { service } = makeService();
    openAICreateMock.mockResolvedValue(makeJsonReply());

    const res = await service.chat({
      messages: [{ role: 'user', content: 'x' }],
      complexity: 'simple',
      tier: 'standard',
    });

    expect(res.modelUsed).toBe('gpt-5-nano');
  });
});

describe('AIProviderService — Gemini fallback', () => {
  it('falls back to Gemini when OpenAI returns null', async () => {
    const { service, gemini } = makeService();
    openAICreateMock.mockResolvedValue({ choices: [{ message: { content: null } }] });

    const res = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      complexity: 'simple',
      tier: 'standard',
      fallbackContext: {
        salonContext: {},
        phone: '',
        message: 'hi',
        history: [],
      },
    });

    expect(gemini.receptionChat).toHaveBeenCalled();
    expect(res.reply).toBe('Gemini fallback reply');
    expect(res.modelUsed).toBe('gemini-fallback');
  });

  it('falls back to Gemini when OpenAI throws', async () => {
    const { service, gemini } = makeService();
    openAICreateMock.mockRejectedValue(new Error('OpenAI 503'));

    const res = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      complexity: 'complex',
      tier: 'premium',
      fallbackContext: {
        salonContext: {},
        phone: '',
        message: 'hi',
        history: [],
      },
    });

    expect(gemini.receptionChat).toHaveBeenCalled();
    expect(res.modelUsed).toBe('gemini-fallback');
  });

  it('falls back to Gemini when OPENAI_API_KEY is missing', async () => {
    const { service, gemini } = makeService({ openaiKey: '' });

    const res = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      complexity: 'simple',
      tier: 'standard',
      fallbackContext: {
        salonContext: {},
        phone: '',
        message: 'hi',
        history: [],
      },
    });

    expect(openAICreateMock).not.toHaveBeenCalled();
    expect(gemini.receptionChat).toHaveBeenCalled();
    expect(res.modelUsed).toBe('gemini-fallback');
  });
});

describe('AIProviderService — JSON response parsing', () => {
  it('parses a valid JSON envelope into V2 fields', async () => {
    const { service } = makeService();
    openAICreateMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: 'مرحبا',
            intent: 'greeting',
            action: 'answer_only',
            extractedData: { serviceName: 'قص', date: null, time: null, customerName: null },
            messageType: 'text',
            buttons: null,
            needsEscalation: false,
            sentiment: 'positive',
            confidence: 0.9,
            wantsToCancel: false,
            isNegotiatingPrice: false,
          }),
        },
      }],
    });

    const res = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      complexity: 'simple',
      tier: 'standard',
    });

    expect(res.intent).toBe('greeting');
    expect(res.action).toBe('answer_only');
    expect(res.extractedData?.serviceName).toBe('قص');
    expect(res.confidence).toBe(0.9);
  });

  it('falls back to plain reply when content is not JSON', async () => {
    const { service } = makeService();
    openAICreateMock.mockResolvedValue({
      choices: [{ message: { content: 'just text, no braces' } }],
    });

    const res = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      complexity: 'simple',
      tier: 'standard',
    });

    expect(res.reply).toBe('just text, no braces');
    expect(res.intent).toBe('general_reply');
  });
});
