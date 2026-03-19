import { Module } from '@nestjs/common';
import { SalonInfoController } from './salon-info.controller';
import { SalonInfoService } from './salon-info.service';

@Module({
  controllers: [SalonInfoController],
  providers: [SalonInfoService],
  exports: [SalonInfoService],
})
export class SalonInfoModule {}
