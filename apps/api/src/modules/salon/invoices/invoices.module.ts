import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PdfModule } from '../../../shared/pdf/pdf.module';
import { SettingsModule } from '../settings/settings.module';
import { EventsModule } from '../../../shared/events';
import { WhatsAppEvolutionModule } from '../whatsapp-evolution/whatsapp-evolution.module';
import { SalonZatcaModule } from '../zatca/zatca.module';

@Module({
  imports: [PdfModule, SettingsModule, EventsModule, WhatsAppEvolutionModule, SalonZatcaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
