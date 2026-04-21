import { Module } from '@nestjs/common';
import { ZatcaController } from './zatca.controller';
import { ZatcaService } from './zatca.service';
import { ZatcaModule as PlatformZatcaModule } from '../../zatca/zatca.module';
import { EncryptionModule } from '../../../shared/encryption/encryption.module';

/**
 * Salon-level ZATCA Module
 *
 * Imports the platform-level ZatcaModule to get shared services
 * (ZatcaCryptoService, ZatcaXmlBuilder) and EncryptionModule for
 * secure private key storage.
 */
@Module({
  imports: [PlatformZatcaModule, EncryptionModule],
  controllers: [ZatcaController],
  providers: [ZatcaService],
  exports: [ZatcaService],
})
export class SalonZatcaModule {}
