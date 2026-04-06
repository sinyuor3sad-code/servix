import { Global, Module } from '@nestjs/common';
import { PlatformPrismaClient } from './platform.client';
import { TenantClientFactory } from './tenant-client.factory';
import { TenantDatabaseService } from './tenant-database.service';
import { PlatformSettingsService } from './platform-settings.service';
import { TenantGuard } from '../guards/tenant.guard';
import { FeatureGuard } from '../guards/feature.guard';

@Global()
@Module({
  providers: [PlatformPrismaClient, TenantClientFactory, TenantDatabaseService, PlatformSettingsService, TenantGuard, FeatureGuard],
  exports: [PlatformPrismaClient, TenantClientFactory, TenantDatabaseService, PlatformSettingsService, TenantGuard, FeatureGuard],
})
export class DatabaseModule {}
