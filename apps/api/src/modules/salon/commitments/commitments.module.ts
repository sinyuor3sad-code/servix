import { Module } from '@nestjs/common';
import { CommitmentsService } from './commitments.service';

@Module({
  providers: [CommitmentsService],
  exports: [CommitmentsService],
})
export class CommitmentsModule {}
