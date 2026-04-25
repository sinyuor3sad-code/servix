import { UnauthorizedException } from '@nestjs/common';
import { WhatsAppEvolutionWebhookController } from './whatsapp-evolution-webhook.controller';
import type { ConfigService } from '@nestjs/config';
import type { PlatformPrismaClient } from '../../../shared/database/platform.client';
import type { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import type { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import type { TenantPrismaClient } from '../../../shared/types';
import type { AIReceptionService } from '../ai-reception/ai-reception.service';
import type { ManagerReplyHandler } from '../ai-reception/manager-reply.handler';
import type { FeaturesService } from '../../../core/features/features.service';
import type { ReviewRequestsService } from './review-requests.service';

type Mock = jest.Mock;

function makeConfig(masterKey?: string | null): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === 'EVOLUTION_API_KEY' ? masterKey ?? undefined : undefined,
    ),
  } as unknown as ConfigService;
}

function makePlatformDb() {
  return {
    whatsAppInstance: {
      findUnique: jest.fn() as Mock,
      update: jest.fn() as Mock,
    },
  };
}

function makeTenantFactory(tenantDb: unknown) {
  return {
    getTenantClient: jest.fn().mockReturnValue(tenantDb),
  } as unknown as TenantClientFactory;
}

function makeAntiBan(): WhatsAppAntiBanService {
  return {
    isOptOutKeyword: jest.fn(),
    addOptOut: jest.fn().mockResolvedValue(undefined),
    check: jest.fn().mockResolvedValue({ allowed: true, delayMs: 0 }),
  } as unknown as WhatsAppAntiBanService;
}

function makeAIReception(): AIReceptionService {
  return {
    handleCustomerMessage: jest.fn().mockResolvedValue(undefined),
    handleStopFollowUpRequest: jest.fn().mockResolvedValue('not_stop'),
  } as unknown as AIReceptionService;
}

function makeManagerReply(): ManagerReplyHandler {
  return {
    handle: jest.fn().mockResolvedValue(undefined),
  } as unknown as ManagerReplyHandler;
}

function makeFeatures(): FeaturesService {
  return {
    isFeatureEnabled: jest.fn().mockResolvedValue({ isEnabled: true }),
  } as unknown as FeaturesService;
}

function makeReviewRequests(): ReviewRequestsService {
  return {
    handleIncomingRating: jest.fn().mockResolvedValue(false),
  } as unknown as ReviewRequestsService;
}

describe('WhatsAppEvolutionWebhookController', () => {
  let platformDb: ReturnType<typeof makePlatformDb>;
  let antiBan: WhatsAppAntiBanService;
  let aiReception: AIReceptionService;
  let managerReply: ManagerReplyHandler;
  let reviewRequests: ReviewRequestsService;
  let features: FeaturesService;
  let tenantDb: unknown;
  let tenantFactory: TenantClientFactory;
  let controller: WhatsAppEvolutionWebhookController;

  beforeEach(() => {
    platformDb = makePlatformDb();
    antiBan = makeAntiBan();
    aiReception = makeAIReception();
    managerReply = makeManagerReply();
    reviewRequests = makeReviewRequests();
    features = makeFeatures();
    tenantDb = { marker: 'tenant-db' };
    tenantFactory = makeTenantFactory(tenantDb);
    controller = new WhatsAppEvolutionWebhookController(
      makeConfig('master-key'),
      platformDb as unknown as PlatformPrismaClient,
      tenantFactory,
      antiBan,
      aiReception,
      managerReply,
      reviewRequests,
      features,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('apikey auth', () => {
    it('يرفض الطلب عند تطابق مفتاح غير صحيح', async () => {
      await expect(
        controller.handle('salon-acme', 'wrong', { event: 'connection.update' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('يرفض الطلب عندما السيرفر بلا مفتاح رئيسي', async () => {
      const c = new WhatsAppEvolutionWebhookController(
        makeConfig(),
        platformDb as unknown as PlatformPrismaClient,
        tenantFactory,
        antiBan,
        aiReception,
        managerReply,
        reviewRequests,
        features,
      );
      await expect(
        c.handle('salon-acme', 'master-key', { event: 'connection.update' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('يقبل الطلب مع المفتاح الصحيح', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue(null);
      const r = await controller.handle('salon-acme', 'master-key', {
        event: 'other.event',
      });
      expect(r).toBe('OK');
    });
  });

  describe('connection.update', () => {
    it('يحدّث الحالة إلى connected ويسجّل lastConnectedAt', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        status: 'qr_pending',
        lastConnectedAt: null,
        lastDisconnectedAt: null,
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'connection.update',
        data: { state: 'open' },
      });

      expect(platformDb.whatsAppInstance.update).toHaveBeenCalled();
      const call = platformDb.whatsAppInstance.update.mock.calls[0][0] as {
        data: { status: string; lastConnectedAt: unknown };
      };
      expect(call.data.status).toBe('connected');
      expect(call.data.lastConnectedAt).toBeInstanceOf(Date);
    });

    it('يسجّل lastDisconnectedAt فقط عند الانتقال من connected', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        status: 'connected',
        lastConnectedAt: new Date(),
        lastDisconnectedAt: null,
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'connection.update',
        data: { state: 'close' },
      });

      const call = platformDb.whatsAppInstance.update.mock.calls[0][0] as {
        data: { status: string; lastDisconnectedAt: unknown };
      };
      expect(call.data.status).toBe('disconnected');
      expect(call.data.lastDisconnectedAt).toBeInstanceOf(Date);
    });

    it('يتجاهل الأحداث للمثيلات غير الموجودة في DB', async () => {
      platformDb.whatsAppInstance.findUnique.mockResolvedValue(null);

      const r = await controller.handle('absent', 'master-key', {
        event: 'connection.update',
        data: { state: 'open' },
      });

      expect(r).toBe('OK');
      expect(platformDb.whatsAppInstance.update).not.toHaveBeenCalled();
    });
  });

  describe('messages.upsert', () => {
    it('يضيف رقم إلى قائمة الإلغاء عند كلمة opt-out من الطرف الآخر', async () => {
      (antiBan.isOptOutKeyword as Mock).mockReturnValue(true);
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        instanceToken: 'token',
        tenantId: 't1',
        tenant: { id: 't1', slug: 'acme', databaseName: 'tenant_acme', status: 'active' },
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: '966501234567@s.whatsapp.net' },
          message: { conversation: 'الغاء' },
        },
      });

      expect(tenantFactory.getTenantClient).toHaveBeenCalledWith('tenant_acme');
      expect(antiBan.addOptOut).toHaveBeenCalledWith(
        tenantDb as TenantPrismaClient,
        '966501234567',
        expect.stringContaining('الغاء'),
      );
    });

    it('يتجاهل رسائلنا المرتدّة (fromMe=true)', async () => {
      (antiBan.isOptOutKeyword as Mock).mockReturnValue(true);

      await controller.handle('salon-acme', 'master-key', {
        event: 'messages.upsert',
        data: {
          key: { fromMe: true, remoteJid: '966501234567@s.whatsapp.net' },
          message: { conversation: 'الغاء' },
        },
      });

      expect(antiBan.addOptOut).not.toHaveBeenCalled();
    });

    it('يتجاهل الرسائل غير المطابقة لكلمات الإلغاء', async () => {
      (antiBan.isOptOutKeyword as Mock).mockReturnValue(false);
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        instanceToken: 'token',
        tenantId: 't1',
        tenant: { id: 't1', slug: 'acme', databaseName: 'tenant_acme', status: 'active' },
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: '966501234567@s.whatsapp.net' },
          message: { conversation: 'مرحبا' },
        },
      });

      expect(antiBan.addOptOut).not.toHaveBeenCalled();
      expect(aiReception.handleCustomerMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          databaseName: 'tenant_acme',
          instanceName: 'salon-acme',
          phone: '966501234567',
          text: 'مرحبا',
        }),
      );
    });

    it('يستخرج النص من extendedTextMessage.text أيضاً', async () => {
      (antiBan.isOptOutKeyword as Mock).mockImplementation(
        (t: string) => t === 'cancel',
      );
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        instanceToken: 'token',
        tenantId: 't1',
        tenant: { id: 't1', slug: 'acme', databaseName: 'tenant_acme', status: 'active' },
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: '966501234567@s.whatsapp.net' },
          message: { extendedTextMessage: { text: 'cancel' } },
        },
      });

      expect(antiBan.addOptOut).toHaveBeenCalled();
    });

    it('يلغي متابعة الطلب النشط قبل تسجيل opt-out عام', async () => {
      (aiReception.handleStopFollowUpRequest as Mock).mockResolvedValue('stopped');
      (antiBan.isOptOutKeyword as Mock).mockReturnValue(true);
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        instanceToken: 'token',
        tenantId: 't1',
        tenant: { id: 't1', slug: 'acme', databaseName: 'tenant_acme', status: 'active' },
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: '966501234567@s.whatsapp.net' },
          message: { conversation: 'stop' },
        },
      });

      expect(aiReception.handleStopFollowUpRequest).toHaveBeenCalled();
      expect(antiBan.addOptOut).not.toHaveBeenCalled();
    });
    it('routes active review ratings before Gemini AI reception', async () => {
      (antiBan.isOptOutKeyword as Mock).mockReturnValue(false);
      (reviewRequests.handleIncomingRating as Mock).mockResolvedValue(true);
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        instanceToken: 'token',
        tenantId: 't1',
        tenant: { id: 't1', slug: 'acme', databaseName: 'tenant_acme', status: 'active' },
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: '966501234567@s.whatsapp.net' },
          message: { conversation: '5' },
        },
      });

      expect(reviewRequests.handleIncomingRating).toHaveBeenCalledWith(expect.objectContaining({
        phone: '966501234567',
        text: '5',
      }));
      expect(aiReception.handleCustomerMessage).not.toHaveBeenCalled();
    });

    it('does not process owner decision commands from an unauthorized phone', async () => {
      (antiBan.isOptOutKeyword as Mock).mockReturnValue(false);
      (tenantFactory.getTenantClient as Mock).mockReturnValue({
        setting: {
          findUnique: jest.fn(({ where }: { where: { key: string } }) =>
            Promise.resolve(where.key === 'ai_manager_phone' ? { value: '966511111111' } : null),
          ),
        },
      });
      platformDb.whatsAppInstance.findUnique.mockResolvedValue({
        instanceName: 'salon-acme',
        instanceToken: 'token',
        tenantId: 't1',
        tenant: { id: 't1', slug: 'acme', databaseName: 'tenant_acme', status: 'active' },
      });

      await controller.handle('salon-acme', 'master-key', {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: '966522222222@s.whatsapp.net' },
          message: { conversation: 'موافق 123' },
        },
      });

      expect(managerReply.handle).not.toHaveBeenCalled();
      expect(aiReception.handleCustomerMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '966522222222',
          text: 'موافق 123',
        }),
      );
    });
  });

  describe('resilience', () => {
    it('يلتقط الخطأ داخلياً ويُرجع OK دائماً (منع retry-storm)', async () => {
      platformDb.whatsAppInstance.findUnique.mockRejectedValue(new Error('db down'));

      const r = await controller.handle('salon-acme', 'master-key', {
        event: 'connection.update',
        data: { state: 'open' },
      });

      expect(r).toBe('OK');
    });
  });
});
