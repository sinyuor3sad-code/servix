import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { DatabaseModule } from '../../../shared/database/database.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
