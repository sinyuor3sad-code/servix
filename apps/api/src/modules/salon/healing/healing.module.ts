import { Module } from '@nestjs/common';
import { HealingService } from './healing.service';
import { CommitmentsModule } from '../commitments/commitments.module';

@Module({
  imports: [CommitmentsModule],
  providers: [HealingService],
  exports: [HealingService],
})
export class HealingModule {}
