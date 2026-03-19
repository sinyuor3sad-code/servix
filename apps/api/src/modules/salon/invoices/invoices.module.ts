import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PdfModule } from '../../../shared/pdf/pdf.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PdfModule, SettingsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
