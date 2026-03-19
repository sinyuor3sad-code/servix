import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EventsGateway } from '../events/events.gateway';
import { CacheService } from '../cache/cache.service';
import { SettingsService } from '../../modules/salon/settings/settings.service';
import { SETTINGS_KEYS } from '../../modules/salon/settings/settings.constants';

interface NotificationJobData {
  tenantId: string;
  channel: 'in_app' | 'email' | 'sms' | 'whatsapp' | 'push';
  recipientType: 'employee' | 'client';
  recipientId: string;
  recipientContact: string;
  titleAr: string;
  bodyAr: string;
  type: string;
  data?: Record<string, unknown>;
}

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly whatsAppService: WhatsAppService,
    private readonly eventsGateway: EventsGateway,
    private readonly cacheService: CacheService,
    private readonly settingsService: SettingsService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const {
      channel,
      recipientContact,
      titleAr,
      bodyAr,
      recipientId,
      data,
      tenantId,
    } = job.data;

    this.logger.log(`Processing ${channel} notification for ${recipientId}`);

    switch (channel) {
      case 'email':
        await this.mailService.send({
          to: recipientContact,
          subject: titleAr,
          body: bodyAr,
        });
        break;
      case 'sms':
        await this.smsService.send({
          to: recipientContact,
          message: `${titleAr}\n${bodyAr}`,
        });
        break;
      case 'whatsapp': {
        const settings = tenantId ? await this.settingsService.getForTenantId(tenantId) : {};
        if (settings[SETTINGS_KEYS.whatsapp_enabled] !== 'true') {
          this.logger.warn(`WhatsApp disabled for tenant ${tenantId}, skipping`);
          break;
        }
        const waCredentials = settings[SETTINGS_KEYS.whatsapp_token] && settings[SETTINGS_KEYS.whatsapp_phone_number_id]
          ? { token: settings[SETTINGS_KEYS.whatsapp_token], phoneNumberId: settings[SETTINGS_KEYS.whatsapp_phone_number_id] }
          : null;
        await this.whatsAppService.send(
          { to: recipientContact, message: `${titleAr}\n${bodyAr}` },
          waCredentials,
        );
        break;
      }
      case 'in_app':
        this.eventsGateway.emitToUser(recipientId, 'notification', {
          title: titleAr,
          body: bodyAr,
          type: job.data.type,
          data,
          createdAt: new Date().toISOString(),
        });
        break;
      case 'push':
        this.logger.warn('Push notifications not implemented yet');
        break;
    }
  }
}
