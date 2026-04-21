import { Module } from '@nestjs/common';
import { ZatcaService } from './zatca.service';
import { ZatcaController } from './zatca.controller';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaXmlBuilder } from './zatca-xml.builder';

/**
 * ZATCA Platform Module
 *
 * Provides shared ZATCA core services (crypto, XML builder) that can be
 * imported by tenant-level modules to avoid code duplication.
 *
 * Exports:
 *   - ZatcaCryptoService: Key gen, hashing, signing, QR TLV
 *   - ZatcaXmlBuilder: UBL 2.1 XML invoice generation
 *   - ZatcaService: Onboarding, reporting, invoice orchestration
 */
@Module({
  controllers: [ZatcaController],
  providers: [ZatcaService, ZatcaCryptoService, ZatcaXmlBuilder],
  exports: [ZatcaService, ZatcaCryptoService, ZatcaXmlBuilder],
})
export class ZatcaModule {}
