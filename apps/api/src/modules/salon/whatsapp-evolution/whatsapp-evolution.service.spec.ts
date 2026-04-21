import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';
import type { ConfigService } from '@nestjs/config';
import type { PlatformPrismaClient } from '../../../shared/database/platform.client';
import type { CircuitBreakerService } from '../../../shared/resilience/circuit-breaker.service';

type Mock = jest.Mock;

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    EVOLUTION_API_URL: 'http://evolution-api:8080',
    EVOLUTION_API_KEY: 'master-key',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

function makePlatformDb(): {
  whatsAppInstance: {
    findUnique: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
  };
} {
  return {
    whatsAppInstance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

/**
 * Transparent CircuitBreakerService double: `fire(...args)` just invokes the
 * wrapped function directly, which is the correct behaviour for unit tests
 * that want to exercise the real HTTP code paths without opossum in the loop.
 */
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

function mockFetchOnce(status: number, body: unknown, contentType = 'application/json') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const res = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  };
  (global.fetch as Mock).mockResolvedValueOnce(res);
}

describe('WhatsAppEvolutionService', () => {
  let service: WhatsAppEvolutionService;
  let platformDb: ReturnType<typeof makePlatformDb>;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    platformDb = makePlatformDb();
    service = new WhatsAppEvolutionService(
      makeConfig(),
      platformDb as unknown as PlatformPrismaClient,
      makeCircuitBreaker(),
    );
    service.onModuleInit();

    originalFetch = global.fetch;
    global.fetch = jest.fn() as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('getOrCreateInstance', () => {
    it('يُرجع المثيل الموجود بدون استدعاء Evolution', async () => {
      const existing = { id: 'x', tenantId: 't1', instanceName: 'salon-acme' };
      platformDb.whatsAppInstance.findUnique.mockResolvedValue(existing);

      const r = await service.getOrCreateInstance('t1', 'acme');

      expect(r).toBe(existing);
      expect(platformDb.whatsAppInstance.create).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('ينشئ مثيلاً جديداً على Evolution ثم على قاعدة البيانات بحالة qr_pending', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue(null);
      mockFetchOnce(200, { instance: { instanceName: 'salon-acme' } });
      const created = { tenantId: 't1', instanceName: 'salon-acme', status: 'qr_pending' };
      platformDb.whatsAppInstance.create.mockResolvedValue(created);

      const r = await service.getOrCreateInstance('t1', 'Acme');

      expect(r).toBe(created);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = (global.fetch as Mock).mock.calls[0];
      expect(call[0]).toBe('http://evolution-api:8080/instance/create');
      expect((call[1] as RequestInit).headers).toEqual(
        expect.objectContaining({ apikey: 'master-key' }),
      );
      const dbCall = platformDb.whatsAppInstance.create.mock.calls[0][0] as {
        data: { tenantId: string; instanceName: string; status: string; instanceToken: string };
      };
      expect(dbCall.data.tenantId).toBe('t1');
      expect(dbCall.data.instanceName).toBe('salon-acme');
      expect(dbCall.data.status).toBe('qr_pending');
      expect(dbCall.data.instanceToken).toMatch(/^[0-9a-f]{48}$/);
    });

    it('يرمي BadGatewayException عندما Evolution يُرجع خطأ', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue(null);
      mockFetchOnce(500, 'Internal error', 'text/plain');

      await expect(service.getOrCreateInstance('t1', 'acme')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(platformDb.whatsAppInstance.create).not.toHaveBeenCalled();
    });
  });

  describe('fetchInstanceDetails', () => {
    it('يحوّل حالة "open" إلى connected ويُخرِج رقم الهاتف من ownerJid', async () => {
      mockFetchOnce(200, [
        {
          connectionStatus: 'open',
          ownerJid: '966501234567@s.whatsapp.net',
          profileName: 'صالون أكمي',
          profilePicUrl: 'https://cdn/pic.jpg',
        },
      ]);

      const r = await service.fetchInstanceDetails('salon-acme');

      expect(r.status).toBe('connected');
      expect(r.phoneNumber).toBe('966501234567');
      expect(r.profileName).toBe('صالون أكمي');
      expect(r.profilePicUrl).toBe('https://cdn/pic.jpg');
    });

    it('يحوّل "close" إلى disconnected', async () => {
      mockFetchOnce(200, [{ connectionStatus: 'close' }]);
      const r = await service.fetchInstanceDetails('salon-acme');
      expect(r.status).toBe('disconnected');
    });

    it('يحوّل "connecting" كما هي', async () => {
      mockFetchOnce(200, [{ connectionStatus: 'connecting' }]);
      const r = await service.fetchInstanceDetails('salon-acme');
      expect(r.status).toBe('connecting');
    });

    it('يحوّل الحالة غير المعروفة إلى error', async () => {
      mockFetchOnce(200, [{ connectionStatus: 'WTF' }]);
      const r = await service.fetchInstanceDetails('salon-acme');
      expect(r.status).toBe('error');
    });

    it('يرمي NotFoundException عند قائمة فارغة', async () => {
      mockFetchOnce(200, []);
      await expect(service.fetchInstanceDetails('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('fetchQrCode', () => {
    it('يُعيد الـ base64 عند النجاح', async () => {
      mockFetchOnce(200, { base64: 'data:image/png;base64,AAA' });
      const r = await service.fetchQrCode('salon-acme');
      expect(r).toBe('data:image/png;base64,AAA');
    });

    it('يسقط إلى حقل code عند غياب base64', async () => {
      mockFetchOnce(200, { code: 'raw-qr-string' });
      const r = await service.fetchQrCode('salon-acme');
      expect(r).toBe('raw-qr-string');
    });

    it('يُرجع null بدل رمي خطأ عند فشل Evolution', async () => {
      mockFetchOnce(500, 'boom', 'text/plain');
      const r = await service.fetchQrCode('salon-acme');
      expect(r).toBeNull();
    });
  });

  describe('sendText', () => {
    it('يُرسل POST بالقيم الصحيحة ويُطبّق رقم 966 الموحّد', async () => {
      mockFetchOnce(200, { id: 'msg-1' });

      await service.sendText({
        instanceName: 'salon-acme',
        instanceToken: 'instance-token-xyz',
        to: '0501234567',
        message: 'hi',
        delayMs: 1200,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://evolution-api:8080/message/sendText/salon-acme',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ apikey: 'instance-token-xyz' }),
        }),
      );
      const body = JSON.parse(
        ((global.fetch as Mock).mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body).toEqual({
        number: '966501234567',
        text: 'hi',
        delay: 1200,
      });
    });

    it('يرمي BadGatewayException عند فشل الإرسال', async () => {
      mockFetchOnce(403, 'forbidden', 'text/plain');

      await expect(
        service.sendText({
          instanceName: 'salon-acme',
          instanceToken: 'tok',
          to: '501234567',
          message: 'hi',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('sendMedia', () => {
    it('يُمرّر mediatype وmedia وcaption واختيارياً fileName', async () => {
      mockFetchOnce(200, { id: 'm-1' });

      await service.sendMedia({
        instanceName: 'salon-acme',
        instanceToken: 'tok',
        to: '501234567',
        message: '',
        mediaUrl: 'https://x/y.pdf',
        mediaType: 'document',
        filename: 'inv.pdf',
        caption: 'فاتورتك',
        delayMs: 500,
      });

      const body = JSON.parse(
        ((global.fetch as Mock).mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body).toEqual({
        number: '966501234567',
        mediatype: 'document',
        media: 'https://x/y.pdf',
        delay: 500,
        fileName: 'inv.pdf',
        caption: 'فاتورتك',
      });
    });
  });

  describe('syncInstanceStatus', () => {
    it('يحدّث الحالة ويُعيّن lastConnectedAt عند الاتصال الجديد', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        status: 'qr_pending',
        lastConnectedAt: null,
        lastDisconnectedAt: null,
      });
      mockFetchOnce(200, [
        { connectionStatus: 'open', ownerJid: '966501234567@s.whatsapp.net' },
      ]);
      platformDb.whatsAppInstance.update.mockResolvedValue({
        instanceName: 'salon-acme',
        status: 'connected',
      });

      const r = await service.syncInstanceStatus('salon-acme');

      expect(r).toEqual(
        expect.objectContaining({ instanceName: 'salon-acme', status: 'connected' }),
      );
      const updateCall = platformDb.whatsAppInstance.update.mock.calls[0][0] as {
        data: { status: string; phoneNumber: string; lastConnectedAt: unknown };
      };
      expect(updateCall.data.status).toBe('connected');
      expect(updateCall.data.phoneNumber).toBe('966501234567');
      expect(updateCall.data.lastConnectedAt).toBeInstanceOf(Date);
    });

    it('يُعيّن lastDisconnectedAt فقط عند الانتقال من connected إلى disconnected', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        status: 'connected',
        lastConnectedAt: new Date('2026-01-01'),
        lastDisconnectedAt: null,
      });
      mockFetchOnce(200, [{ connectionStatus: 'close' }]);
      platformDb.whatsAppInstance.update.mockResolvedValue({ instanceName: 'salon-acme' });

      await service.syncInstanceStatus('salon-acme');

      const updateCall = platformDb.whatsAppInstance.update.mock.calls[0][0] as {
        data: { status: string; lastDisconnectedAt: unknown };
      };
      expect(updateCall.data.status).toBe('disconnected');
      expect(updateCall.data.lastDisconnectedAt).toBeInstanceOf(Date);
    });

    it('يُرجع null عندما لا يوجد مثيل في DB', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue(null);
      const r = await service.syncInstanceStatus('absent');
      expect(r).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('يرمي BadGatewayException عند غياب EVOLUTION_API_KEY', async () => {
      const svc = new WhatsAppEvolutionService(
        makeConfig({ EVOLUTION_API_KEY: '' }),
        platformDb as unknown as PlatformPrismaClient,
        makeCircuitBreaker(),
      );
      svc.onModuleInit();

      await expect(svc.fetchQrCode('anything')).resolves.toBeNull();
      // fetchQrCode swallows errors to null, but logoutInstance also does —
      // use the path that propagates: fetchInstanceDetails.
      await expect(svc.fetchInstanceDetails('x')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });
});
