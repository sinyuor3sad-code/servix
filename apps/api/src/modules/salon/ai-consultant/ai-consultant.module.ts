import { Module } from '@nestjs/common';
import { AiConsultantController } from './ai-consultant.controller';
import { AiConsultantService } from './ai-consultant.service';

@Module({
  controllers: [AiConsultantController],
  providers: [AiConsultantService],
  exports: [AiConsultantService],
})
export class AiConsultantModule {}
