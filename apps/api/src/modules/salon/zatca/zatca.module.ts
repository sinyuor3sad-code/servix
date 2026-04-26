import { Module } from '@nestjs/common';
import { ZatcaController } from './zatca.controller';
import { SalonZatcaService } from './zatca.service';
import { ZatcaModule as PlatformZatcaModule } from '../../zatca/zatca.module';
import { EncryptionModule } from '../../../shared/encryption/encryption.module';

/**
 * Salon-level ZATCA Module
 *
 * Imports the platform-level ZatcaModule to get shared services
 * (ZatcaCryptoService, ZatcaXmlBuilder, ZatcaService) and EncryptionModule for
 * secure private key storage.
 */
@Module({
  imports: [PlatformZatcaModule, EncryptionModule],
  controllers: [ZatcaController],
  providers: [SalonZatcaService],
  exports: [SalonZatcaService],
})
export class SalonZatcaModule {}
