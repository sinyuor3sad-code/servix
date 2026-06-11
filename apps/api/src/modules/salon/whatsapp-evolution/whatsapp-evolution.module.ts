import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppEvolutionController } from './whatsapp-evolution.controller';
import { WhatsAppEvolutionWebhookController } from './whatsapp-evolution-webhook.controller';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';
import { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import { WhatsAppRichMediaService } from './whatsapp-rich-media.service';
import { ReviewRequestsService } from './review-requests.service';
import { SettingsModule } from '../settings/settings.module';
import { AIReceptionModule } from '../ai-reception/ai-reception.module';
import { FeaturesService } from '../../../core/features/features.service';

@Module({
  imports: [SettingsModule, forwardRef(() => AIReceptionModule)],
  controllers: [WhatsAppEvolutionController, WhatsAppEvolutionWebhookController],
  providers: [
    WhatsAppEvolutionService,
    WhatsAppAntiBanService,
    WhatsAppRichMediaService,
    ReviewRequestsService,
    FeaturesService,
  ],
  exports: [WhatsAppEvolutionService, WhatsAppAntiBanService, WhatsAppRichMediaService, ReviewRequestsService],
})
export class WhatsAppEvolutionModule {}
