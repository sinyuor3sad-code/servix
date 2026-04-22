import { Module, forwardRef } from '@nestjs/common';
import { AIContextBuilder } from './ai-context.builder';
import { AIReceptionService } from './ai-reception.service';
import { AIReceptionExpirer } from './ai-reception.expirer';
import { ManagerReplyHandler } from './manager-reply.handler';
import { N8nClient } from './n8n.client';
import { WhatsAppEvolutionModule } from '../whatsapp-evolution/whatsapp-evolution.module';
import { FeaturesService } from '../../../core/features/features.service';

@Module({
  imports: [forwardRef(() => WhatsAppEvolutionModule)],
  providers: [
    AIContextBuilder,
    AIReceptionService,
    AIReceptionExpirer,
    ManagerReplyHandler,
    N8nClient,
    FeaturesService,
  ],
  exports: [AIReceptionService, ManagerReplyHandler],
})
export class AIReceptionModule {}
