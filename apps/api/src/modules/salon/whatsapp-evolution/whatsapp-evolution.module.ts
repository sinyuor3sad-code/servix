import { Module } from '@nestjs/common';
import { WhatsAppEvolutionController } from './whatsapp-evolution.controller';
import { WhatsAppEvolutionWebhookController } from './whatsapp-evolution-webhook.controller';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';
import { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [WhatsAppEvolutionController, WhatsAppEvolutionWebhookController],
  providers: [WhatsAppEvolutionService, WhatsAppAntiBanService],
  exports: [WhatsAppEvolutionService, WhatsAppAntiBanService],
})
export class WhatsAppEvolutionModule {}
