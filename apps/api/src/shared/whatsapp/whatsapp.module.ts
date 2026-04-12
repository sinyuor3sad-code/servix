import { Global, Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppConnectController } from './whatsapp-connect.controller';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { TenantResolverService } from './tenant-resolver.service';
import { FeaturesService } from '../../core/features/features.service';
import { SettingsService } from '../../modules/salon/settings/settings.service';

@Global()
@Module({
  controllers: [WhatsAppWebhookController, WhatsAppConnectController],
  providers: [WhatsAppService, WhatsAppBotService, TenantResolverService, FeaturesService, SettingsService],
  exports: [WhatsAppService, WhatsAppBotService, TenantResolverService],
})
export class WhatsAppModule {}
