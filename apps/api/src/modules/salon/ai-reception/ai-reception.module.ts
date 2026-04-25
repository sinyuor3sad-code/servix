import { Module, forwardRef } from '@nestjs/common';
import { AIContextBuilder } from './ai-context.builder';
import { AIReceptionService } from './ai-reception.service';
import { AIReceptionExpirer } from './ai-reception.expirer';
import { ManagerReplyHandler } from './manager-reply.handler';
import { N8nClient } from './n8n.client';
import { AIReceptionBookingService } from './ai-reception-booking.service';
import { AIReceptionSettingsService } from './ai-reception-settings.service';
import { WhatsAppEvolutionModule } from '../whatsapp-evolution/whatsapp-evolution.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SettingsModule } from '../settings/settings.module';
import { FeaturesService } from '../../../core/features/features.service';

// GeminiService is @Global() via AiModule — no need to import here

@Module({
  imports: [forwardRef(() => WhatsAppEvolutionModule), AppointmentsModule, SettingsModule],
  providers: [
    AIContextBuilder,
    AIReceptionService,
    AIReceptionExpirer,
    ManagerReplyHandler,
    N8nClient,
    AIReceptionBookingService,
    AIReceptionSettingsService,
    FeaturesService,
  ],
  exports: [AIReceptionService, ManagerReplyHandler],
})
export class AIReceptionModule {}
