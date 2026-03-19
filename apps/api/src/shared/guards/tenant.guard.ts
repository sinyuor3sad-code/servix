import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PlatformPrismaClient } from '../database/platform.client';

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

    const tenantUser = await this.platformPrisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.sub,
        },
      },
    });

    if (!tenantUser || tenantUser.status !== 'active') {
      throw new ForbiddenException(
        'ليس لديك صلاحية للوصول إلى هذا الحساب',
      );
    }

    return true;
  }
}
