import { Module } from '@nestjs/common';
import { PosShiftsController } from './pos-shifts.controller';
import { PosShiftsService } from './pos-shifts.service';
import { PosShiftsExpirer } from './pos-shifts.expirer';
import { HeldBillsService } from './held-bills.service';

@Module({
  controllers: [PosShiftsController],
  providers: [PosShiftsService, PosShiftsExpirer, HeldBillsService],
  exports: [PosShiftsService],
})
export class PosShiftsModule {}
