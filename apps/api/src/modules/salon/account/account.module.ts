import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { DatabaseModule } from '../../../shared/database';
import { SubscriptionsModule } from '../../../core/subscriptions/subscriptions.module';

@Module({
  imports: [DatabaseModule, SubscriptionsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
