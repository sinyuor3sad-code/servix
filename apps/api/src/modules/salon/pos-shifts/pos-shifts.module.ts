import { Module } from '@nestjs/common';
import { PosShiftsController } from './pos-shifts.controller';
import { PosShiftsService } from './pos-shifts.service';

@Module({
  controllers: [PosShiftsController],
  providers: [PosShiftsService],
  exports: [PosShiftsService],
})
export class PosShiftsModule {}
