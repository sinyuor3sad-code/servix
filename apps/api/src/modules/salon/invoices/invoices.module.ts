import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PdfModule } from '../../../shared/pdf/pdf.module';
import { SettingsModule } from '../settings/settings.module';
import { EventsModule } from '../../../shared/events';
import { WhatsAppEvolutionModule } from '../whatsapp-evolution/whatsapp-evolution.module';

@Module({
  imports: [PdfModule, SettingsModule, EventsModule, WhatsAppEvolutionModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
