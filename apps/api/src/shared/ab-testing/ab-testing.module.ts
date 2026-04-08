import { Global, Module } from '@nestjs/common';
import { ABTestingService } from './ab-testing.service';

@Global()
@Module({
  providers: [ABTestingService],
  exports: [ABTestingService],
})
export class ABTestingModule {}
