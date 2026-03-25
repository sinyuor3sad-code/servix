import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { CommitmentsModule } from '../commitments/commitments.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [CommitmentsModule, InventoryModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
