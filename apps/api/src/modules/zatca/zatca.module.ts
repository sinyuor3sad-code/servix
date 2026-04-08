import { Module } from '@nestjs/common';
import { ZatcaService } from './zatca.service';
import { ZatcaController } from './zatca.controller';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaXmlBuilder } from './zatca-xml.builder';

@Module({
  controllers: [ZatcaController],
  providers: [ZatcaService, ZatcaCryptoService, ZatcaXmlBuilder],
  exports: [ZatcaService],
})
export class ZatcaModule {}
