import { Global, Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AIProviderService } from './ai-provider.service';

@Global()
@Module({
  providers: [GeminiService, AIProviderService],
  exports: [GeminiService, AIProviderService],
})
export class AiModule {}
