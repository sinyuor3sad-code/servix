import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditOutboxProcessor } from './audit-outbox.processor';

@Global()
@Module({
  controllers: [AuditController],
  // AuditOutboxProcessor drains platform_audit_outbox → platform_audit_logs
  // (V-35b). It relies on the global DatabaseModule, MetricsModule and
  // ScheduleModule (forRoot in AppModule) — no extra imports needed here.
  providers: [AuditService, AuditOutboxProcessor],
  exports: [AuditService],
})
export class AuditModule {}
