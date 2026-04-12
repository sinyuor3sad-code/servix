import { Global, Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { TenantResolverService } from './tenant-resolver.service';

@Global()
@Module({
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppService, WhatsAppBotService, TenantResolverService],
  exports: [WhatsAppService, WhatsAppBotService, TenantResolverService],
})
export class WhatsAppModule {}
