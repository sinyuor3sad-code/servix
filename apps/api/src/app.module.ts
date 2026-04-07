import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { APP_GUARD } from '@nestjs/core';
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
import { JobsModule } from './shared/jobs';
// Sentry is optionally loaded via instrument.ts
import { JwtAuthGuard, SubscriptionWriteGuard, RateLimitGuard } from './shared/guards';
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
    {
      provide: APP_GUARD,
      useClass: SubscriptionWriteGuard,
    },
  ],
})
export class AppModule {}
