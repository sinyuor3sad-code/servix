import { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import type { TenantPrismaClient } from '../../../shared/types';
import type { CacheService } from '../../../shared/cache/cache.service';
import type { SettingsService } from '../settings/settings.service';

type Mock = jest.Mock;

interface SettingsOverrides {
  whatsapp_marketing_enabled?: string;
  whatsapp_business_hours_enabled?: string;
  whatsapp_business_hours_start?: string;
  whatsapp_business_hours_end?: string;
  whatsapp_rate_limit_per_hour?: string;
  whatsapp_random_delay_min_ms?: string;
  whatsapp_random_delay_max_ms?: string;
}

function defaultSettings(overrides: SettingsOverrides = {}): Record<string, string> {
  return {
    whatsapp_marketing_enabled: 'true',
    whatsapp_business_hours_enabled: 'false',
    whatsapp_business_hours_start: '09:00',
    whatsapp_business_hours_end: '22:00',
    whatsapp_rate_limit_per_hour: '30',
    whatsapp_random_delay_min_ms: '1500',
    whatsapp_random_delay_max_ms: '4500',
    ...overrides,
  };
}

function makeTenantDb(): {
  whatsAppOptOut: {
    findUnique: Mock;
    upsert: Mock;
    deleteMany: Mock;
    findMany: Mock;
  };
} {
  return {
    whatsAppOptOut: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

function makeService(settings: Record<string, string>, rateCount = 1) {
  const cache = {
    incrementRateLimit: jest.fn().mockResolvedValue(rateCount),
  } as unknown as CacheService;
  const settingsService = {
    getAll: jest.fn().mockResolvedValue(settings),
  } as unknown as SettingsService;
  return {
    service: new WhatsAppAntiBanService(cache, settingsService),
    cache: cache as unknown as { incrementRateLimit: Mock },
    settingsService: settingsService as unknown as { getAll: Mock },
  };
}

describe('WhatsAppAntiBanService', () => {
  describe('check — opt-out list', () => {
    it('يرفض الإرسال عندما الرقم في قائمة إلغاء الاشتراك', async () => {
      const { service } = makeService(defaultSettings());
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue({ phone: '966501234567' });

      const r = await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: '0501234567',
      });

      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('recipient_opted_out');
      expect(db.whatsAppOptOut.findUnique).toHaveBeenCalledWith({
        where: { phone: '966501234567' },
      });
    });
  });

  describe('check — marketing gates', () => {
    it('يرفض الرسائل التسويقية عندما التسويق معطَّل', async () => {
      const { service } = makeService(
        defaultSettings({ whatsapp_marketing_enabled: 'false' }),
      );
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue(null);

      const r = await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: '501234567',
        isMarketing: true,
      });

      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('marketing_disabled');
    });

    it('يرفض الرسائل التسويقية خارج ساعات العمل (ريّاض)', async () => {
      // نثبّت الزمن على 06:00 ريّاض ⇒ 03:00 UTC
      jest.useFakeTimers().setSystemTime(new Date('2026-04-20T03:00:00Z'));
      const { service } = makeService(
        defaultSettings({
          whatsapp_business_hours_enabled: 'true',
          whatsapp_business_hours_start: '09:00',
          whatsapp_business_hours_end: '22:00',
        }),
      );
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue(null);

      const r = await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: '501234567',
        isMarketing: true,
      });

      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('outside_business_hours');
      jest.useRealTimers();
    });

    it('يسمح بالرسالة التسويقية داخل ساعات العمل', async () => {
      // 14:00 ريّاض ⇒ 11:00 UTC
      jest.useFakeTimers().setSystemTime(new Date('2026-04-20T11:00:00Z'));
      const { service } = makeService(
        defaultSettings({
          whatsapp_business_hours_enabled: 'true',
          whatsapp_business_hours_start: '09:00',
          whatsapp_business_hours_end: '22:00',
        }),
      );
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue(null);

      const r = await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: '501234567',
        isMarketing: true,
      });

      expect(r.allowed).toBe(true);
      jest.useRealTimers();
    });
  });

  describe('check — rate limit', () => {
    it('يرفض عند تجاوز الحد الأقصى في الساعة', async () => {
      const { service } = makeService(
        defaultSettings({ whatsapp_rate_limit_per_hour: '5' }),
        6,
      );
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue(null);

      const r = await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: '501234567',
      });

      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('rate_limit_exceeded');
    });

    it('يتخطّى الحد عندما = 0', async () => {
      const { service, cache } = makeService(
        defaultSettings({ whatsapp_rate_limit_per_hour: '0' }),
        9999,
      );
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue(null);

      const r = await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: '501234567',
      });

      expect(r.allowed).toBe(true);
      expect(cache.incrementRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('check — human-like delay', () => {
    it('يختار تأخيراً ضمن النطاق المحدد', async () => {
      const { service } = makeService(
        defaultSettings({
          whatsapp_random_delay_min_ms: '2000',
          whatsapp_random_delay_max_ms: '2500',
        }),
        1,
      );
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue(null);

      const r = await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: '501234567',
      });

      expect(r.allowed).toBe(true);
      expect(r.delayMs).toBeGreaterThanOrEqual(2000);
      expect(r.delayMs).toBeLessThan(2500);
    });
  });

  describe('normalizePhone', () => {
    it.each([
      ['0501234567', '966501234567'],
      ['501234567', '966501234567'],
      ['966501234567', '966501234567'],
      ['+966 50 123 4567', '966501234567'],
    ])('%s → %s', async (input, expected) => {
      const { service } = makeService(defaultSettings());
      const db = makeTenantDb();
      db.whatsAppOptOut.findUnique.mockResolvedValue(null);

      await service.check({
        tenantId: 't1',
        tenantDb: db as unknown as TenantPrismaClient,
        phone: input,
      });

      expect(db.whatsAppOptOut.findUnique).toHaveBeenCalledWith({
        where: { phone: expected },
      });
    });
  });

  describe('isOptOutKeyword', () => {
    let service: WhatsAppAntiBanService;

    beforeEach(() => {
      service = makeService(defaultSettings()).service;
    });

    it.each(['stop', 'STOP', 'الغاء', 'إلغاء', 'توقف', 'unsubscribe', 'cancel'])(
      'يطابق "%s"',
      (w) => expect(service.isOptOutKeyword(w)).toBe(true),
    );

    it('يطابق جملة تبدأ بكلمة إلغاء', () => {
      expect(service.isOptOutKeyword('الغاء الاشتراك من الرسائل')).toBe(true);
    });

    it('لا يطابق رسالة طبيعية', () => {
      expect(service.isOptOutKeyword('مرحباً، أريد حجزاً')).toBe(false);
      expect(service.isOptOutKeyword('')).toBe(false);
      expect(service.isOptOutKeyword('    ')).toBe(false);
    });
  });

  describe('opt-out CRUD', () => {
    it('addOptOut ينظّم الرقم ويحفظ السبب مقصوصاً', async () => {
      const { service } = makeService(defaultSettings());
      const db = makeTenantDb();
      db.whatsAppOptOut.upsert.mockResolvedValue({});

      const longReason = 'ر'.repeat(300);
      await service.addOptOut(
        db as unknown as TenantPrismaClient,
        '0501234567',
        longReason,
      );

      expect(db.whatsAppOptOut.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phone: '966501234567' },
          create: expect.objectContaining({
            phone: '966501234567',
            reason: expect.any(String),
          }),
        }),
      );
      const call = db.whatsAppOptOut.upsert.mock.calls[0][0] as {
        create: { reason: string };
      };
      expect(call.create.reason.length).toBeLessThanOrEqual(200);
    });

    it('removeOptOut ينظّم الرقم ويمسح السجل', async () => {
      const { service } = makeService(defaultSettings());
      const db = makeTenantDb();
      db.whatsAppOptOut.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeOptOut(
        db as unknown as TenantPrismaClient,
        '+966-50-123-4567',
      );

      expect(db.whatsAppOptOut.deleteMany).toHaveBeenCalledWith({
        where: { phone: '966501234567' },
      });
    });

    it('listOptOuts يُرجع ما تُعيده قاعدة البيانات', async () => {
      const { service } = makeService(defaultSettings());
      const db = makeTenantDb();
      const rows = [
        { phone: '966500000001', reason: null, optedOutAt: new Date() },
      ];
      db.whatsAppOptOut.findMany.mockResolvedValue(rows);

      const r = await service.listOptOuts(db as unknown as TenantPrismaClient);

      expect(r).toBe(rows);
    });
  });
});
