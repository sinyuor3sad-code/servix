import { Module, forwardRef } from '@nestjs/common';
import { AIContextBuilder } from './ai-context.builder';
import { AIReceptionService } from './ai-reception.service';
import { AIReceptionController } from './ai-reception.controller';
import { AIReceptionExpirer } from './ai-reception.expirer';
import { ManagerReplyHandler } from './manager-reply.handler';
// N8nClient is no longer wired into AIReceptionService — V2 calls AIProviderService directly.
// The file is kept for reference / spec, but it must NOT be re-added as a provider here.
import { AIReceptionBookingService } from './ai-reception-booking.service';
import { AIReceptionSettingsService } from './ai-reception-settings.service';
import { AISafetyNetService } from './ai-safety-net.service';
import { AIClientMemoryService } from './ai-client-memory.service';
import { AISemanticCacheService } from './ai-semantic-cache.service';
import { AIAnalyticsService } from './ai-analytics.service';
import { AIProactiveService } from './ai-proactive.service';
import { WhatsAppEvolutionModule } from '../whatsapp-evolution/whatsapp-evolution.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SettingsModule } from '../settings/settings.module';
import { FeaturesService } from '../../../core/features/features.service';

// GeminiService is @Global() via AiModule — no need to import here

@Module({
  imports: [forwardRef(() => WhatsAppEvolutionModule), AppointmentsModule, SettingsModule],
  controllers: [AIReceptionController],
  providers: [
    AIContextBuilder,
    AIReceptionService,
    AIReceptionExpirer,
    ManagerReplyHandler,
    AIReceptionBookingService,
    AIReceptionSettingsService,
    AISafetyNetService,
    AIClientMemoryService,
    AISemanticCacheService,
    AIAnalyticsService,
    AIProactiveService,
    FeaturesService,
  ],
  exports: [AIReceptionService, ManagerReplyHandler, AIClientMemoryService, AISemanticCacheService, AIAnalyticsService, AIProactiveService],
})
export class AIReceptionModule {}
