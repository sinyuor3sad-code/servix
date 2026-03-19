import { Global, Module } from '@nestjs/common';
import { PlatformPrismaClient } from './platform.client';
import { TenantClientFactory } from './tenant-client.factory';
import { TenantGuard } from '../guards/tenant.guard';
import { FeatureGuard } from '../guards/feature.guard';

@Global()
@Module({
  providers: [PlatformPrismaClient, TenantClientFactory, TenantGuard, FeatureGuard],
  exports: [PlatformPrismaClient, TenantClientFactory, TenantGuard, FeatureGuard],
})
export class DatabaseModule {}
