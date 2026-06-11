import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppConfigValidationSchema } from './shared/config/env.validation';
import { DatabaseModule } from './shared/database';
import { CacheModule } from './shared/cache';
import { PdfModule } from './shared/pdf/pdf.module';
import { SecurityModule } from './shared/security';
import { EventsModule } from './shared/events';
import { MailModule } from './shared/mail';
import { SmsModule } from './shared/sms';
import { WhatsAppModule } from './shared/whatsapp';
import { AiModule } from './shared/ai';
import { CalendarModule } from './shared/calendar';
import { JobsModule } from './shared/jobs';
// Sentry is optionally loaded via instrument.ts
import { JwtAuthGuard, SubscriptionWriteGuard, RateLimitGuard, TenantGuard, PermissionGuard, QuotaGuard } from './shared/guards';
import { TenantMiddleware } from './shared/middleware/tenant.middleware';
import { AuthModule } from './core/auth/auth.module';
import { TenantsModule } from './core/tenants/tenants.module';
import { SubscriptionsModule } from './core/subscriptions/subscriptions.module';
import { FeaturesModule } from './core/features/features.module';
import { RolesModule } from './core/roles/roles.module';
import { AuditModule } from './core/audit/audit.module';
import { UsersModule } from './core/users/users.module';
import { UploadsModule } from './core/uploads/uploads.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { AdminModule } from './core/admin/admin.module';
import { HealthModule } from './core/health/health.module';
import { SalonModule } from './modules/salon/salon.module';
import { PublicModule } from './modules/public/public.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DataRightsModule } from './modules/data-rights/data-rights.module';
import { MetricsModule } from './shared/metrics/metrics.module';
import { HttpMetricsInterceptor } from './shared/metrics/http-metrics.interceptor';
import { DistributedLockModule } from './shared/locks/distributed-lock.module';
import { CircuitBreakerModule } from './shared/resilience/circuit-breaker.module';
import { ReadReplicaModule } from './shared/database/read-replica.module';
import { EncryptionModule } from './shared/encryption/encryption.module';
import { VaultModule } from './shared/config/vault.module';
import { winstonConfig } from './shared/logger/winston.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: AppConfigValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    WinstonModule.forRoot(winstonConfig),
    DatabaseModule,
    CacheModule,
    PdfModule,
    SecurityModule,
    EventsModule,
    MailModule,
    SmsModule,
    WhatsAppModule,
    AiModule,
    CalendarModule,
    JobsModule,

    AuthModule,
    TenantsModule,
    SubscriptionsModule,
    FeaturesModule,
    RolesModule,
    AuditModule,
    UsersModule,
    UploadsModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
    SalonModule,
    PublicModule,
    ComplianceModule,
    DataRightsModule,
    MetricsModule,
    DistributedLockModule,
    CircuitBreakerModule,
    ReadReplicaModule,
    EncryptionModule,
    VaultModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantMiddleware,
    },
    // V-38 / A2-13: TenantGuard registered globally AFTER TenantMiddleware
    // so request.tenant is populated. Verifies the JWT user has an
    // ACTIVE TenantUser row linking them to the JWT's tenant — closes
    // the gap for future controllers added without the explicit
    // @UseGuards(TenantGuard) decorator. See docs/migrations/v38-apply.md.
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionWriteGuard,
    },
    // V-123a — PermissionGuard registered globally so @RequirePermission is
    // enforced on every request without per-controller @UseGuards (the inert-
    // guard trap that left @Roles dead on RolesController). Runs after
    // JwtAuthGuard so request.user.roleId is populated. Dormant until routes
    // declare @RequirePermission (V-123b): no metadata → pass-through.
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    // V-37-wire — QuotaGuard registered globally so @QuotaResource creation
    // routes enforce plan limits. Was registered NOWHERE before (V-37-unwired):
    // quotas were never enforced at runtime. Runs after TenantMiddleware/
    // TenantGuard (request.tenantDb populated) and after PermissionGuard
    // (authorization decided before quota). Routes without @QuotaResource
    // metadata pass through (V-37c).
    {
      provide: APP_GUARD,
      useClass: QuotaGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
