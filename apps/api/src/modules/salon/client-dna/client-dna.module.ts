import { Module } from '@nestjs/common';
import { ClientDnaController } from './client-dna.controller';
import { ClientDnaService } from './client-dna.service';

@Module({
  controllers: [ClientDnaController],
  providers: [ClientDnaService],
  exports: [ClientDnaService],
})
export class ClientDnaModule {}
