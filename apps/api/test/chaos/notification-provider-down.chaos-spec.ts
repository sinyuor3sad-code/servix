/**
 * Chaos: external notification providers are down.
 *
 * The notification pipeline is async by design:
 *   1. Caller persists the notification row + emits websocket event (in-app delivery, sync)
 *   2. Caller enqueues a BullMQ job to send via email / SMS / WhatsApp (async)
 *   3. NotificationProcessor pulls the job and calls the underlying provider
 *
 * The contract this suite verifies:
 *   • In-app delivery works with EVERY external provider failing —
 *     it never depends on Mail/SMS/WhatsApp.
 *   • When an async provider fails, the processor THROWS so BullMQ retries
 *     (that's the designed recovery mechanism — silent swallow would be worse).
 *   • Unrelated channels in the same job batch don't cascade (a WhatsApp
 *     failure in one job doesn't corrupt the email path in the next).
 *
 * See tooling/chaos/scenarios.md §4–§5.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { NotificationProcessor } from '../../src/shared/jobs/notification.processor';
import { MailService } from '../../src/shared/mail/mail.service';
import { SmsService } from '../../src/shared/sms/sms.service';
import { WhatsAppService } from '../../src/shared/whatsapp/whatsapp.service';
import { EventsGateway } from '../../src/shared/events/events.gateway';
import { CacheService } from '../../src/shared/cache/cache.service';
import { SettingsService } from '../../src/modules/salon/settings/settings.service';

const PROVIDER_DOWN = new Error('Upstream 503 — provider unavailable');

const baseJobData = {
  tenantId: 't-1',
  recipientType: 'client' as const,
  recipientId: 'user-42',
  recipientContact: '+966500000000',
  titleAr: 'موعدك غداً',
  bodyAr: 'لا تنسَ موعدك في الساعة 10 صباحاً',
  type: 'reminder',
};

function makeJob(channel: string): Job {
  return {
    data: { ...baseJobData, channel },
    id: `job-${channel}-${Date.now()}`,
    name: `send-${channel}`,
  } as unknown as Job;
}

describe('Chaos: notification providers failing', () => {
  let processor: NotificationProcessor;
  let mail: jest.Mocked<Pick<MailService, 'send'>>;
  let sms: jest.Mocked<Pick<SmsService, 'send'>>;
  let whatsApp: jest.Mocked<Pick<WhatsAppService, 'send'>>;
  let events: jest.Mocked<Pick<EventsGateway, 'emitToUser'>>;
  let settings: jest.Mocked<Pick<SettingsService, 'getForTenantId'>>;

  beforeEach(async () => {
    mail = { send: jest.fn() };
    sms = { send: jest.fn() };
    whatsApp = { send: jest.fn() };
    events = { emitToUser: jest.fn() };
    settings = { getForTenantId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: MailService, useValue: mail },
        { provide: SmsService, useValue: sms },
        { provide: WhatsAppService, useValue: whatsApp },
        { provide: EventsGateway, useValue: events },
        { provide: CacheService, useValue: {} },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();

    processor = module.get(NotificationProcessor);
  });

  describe('in-app channel is immune to external outages', () => {
    it('delivers via websocket even when mail/sms/whatsapp are down', async () => {
      mail.send.mockRejectedValue(PROVIDER_DOWN);
      sms.send.mockRejectedValue(PROVIDER_DOWN);
      whatsApp.send.mockRejectedValue(PROVIDER_DOWN);

      await expect(processor.process(makeJob('in_app'))).resolves.toBeUndefined();

      expect(events.emitToUser).toHaveBeenCalledWith(
        'user-42',
        'notification',
        expect.objectContaining({ title: 'موعدك غداً', body: 'لا تنسَ موعدك في الساعة 10 صباحاً' }),
      );
      expect(mail.send).not.toHaveBeenCalled();
      expect(sms.send).not.toHaveBeenCalled();
      expect(whatsApp.send).not.toHaveBeenCalled();
    });
  });

  describe('async provider failures re-throw so BullMQ can retry', () => {
    it('email channel: re-throws when MailService fails', async () => {
      mail.send.mockRejectedValue(PROVIDER_DOWN);
      await expect(processor.process(makeJob('email'))).rejects.toThrow('provider unavailable');
      expect(mail.send).toHaveBeenCalledTimes(1);
    });

    it('sms channel: re-throws when SmsService fails', async () => {
      sms.send.mockRejectedValue(PROVIDER_DOWN);
      await expect(processor.process(makeJob('sms'))).rejects.toThrow('provider unavailable');
      expect(sms.send).toHaveBeenCalledTimes(1);
    });

    it('whatsapp channel: re-throws when WhatsAppService fails', async () => {
      settings.getForTenantId.mockResolvedValue({
        whatsapp_enabled: 'true',
        whatsapp_token: 'tok',
        whatsapp_phone_number_id: 'pid',
      });
      whatsApp.send.mockRejectedValue(PROVIDER_DOWN);

      await expect(processor.process(makeJob('whatsapp'))).rejects.toThrow('provider unavailable');
      expect(whatsApp.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('whatsapp: disabled-by-tenant does NOT retry (config, not outage)', () => {
    it('returns cleanly without calling the provider when whatsapp_enabled is off', async () => {
      settings.getForTenantId.mockResolvedValue({
        whatsapp_enabled: 'false',
      });

      await expect(processor.process(makeJob('whatsapp'))).resolves.toBeUndefined();
      expect(whatsApp.send).not.toHaveBeenCalled();
    });
  });

  describe('provider failures are isolated per-job (no cross-contamination)', () => {
    it('an sms failure does not affect a subsequent email job', async () => {
      sms.send.mockRejectedValueOnce(PROVIDER_DOWN);
      mail.send.mockResolvedValue();

      await expect(processor.process(makeJob('sms'))).rejects.toThrow('provider unavailable');
      await expect(processor.process(makeJob('email'))).resolves.toBeUndefined();

      expect(mail.send).toHaveBeenCalledTimes(1);
    });
  });
});
