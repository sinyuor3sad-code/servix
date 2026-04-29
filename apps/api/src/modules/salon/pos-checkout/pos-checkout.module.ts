import { Module } from '@nestjs/common';
import { PosCheckoutController } from './pos-checkout.controller';
import { PosCheckoutService } from './pos-checkout.service';

@Module({
  controllers: [PosCheckoutController],
  providers: [PosCheckoutService],
  exports: [PosCheckoutService],
})
export class PosCheckoutModule {}
