import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PlatformPrismaClient } from '../database/platform.client';
import { assertActiveTenantUser } from '../auth/tenant-user.helper';

interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  roleId?: string;
}

import type { Tenant } from '../database';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly platformPrisma: PlatformPrismaClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { tenant?: Tenant }
    >();
    const user = request.user as JwtPayload | undefined;
    const tenant = request.tenant;

    if (!user || !tenant) {
      throw new ForbiddenException('غير مصرح بالوصول لهذا الحساب');
    }

    if (tenant.status === 'suspended') {
      throw new ForbiddenException('حساب الصالون معلّق');
    }

    // V-01 refactor: extracted shared check so WsAuthGuard and the
    // HTTP TenantGuard agree on what "active tenant link" means.
    await assertActiveTenantUser(this.platformPrisma, tenant.id, user.sub);

    return true;
  }
}
