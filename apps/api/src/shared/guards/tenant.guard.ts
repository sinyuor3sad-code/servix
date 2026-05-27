import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PlatformPrismaClient } from '../database/platform.client';
import { assertActiveTenantUser } from '../auth/tenant-user.helper';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  roleId?: string;
}

import type { Tenant } from '../database';

// V-38 / A2-13 — TenantGuard is now registered as a global APP_GUARD
// (apps/api/src/app.module.ts, AFTER TenantMiddleware so request.tenant
// is populated). The 30 pre-V-38 `@UseGuards(TenantGuard)` decorators
// on salon controllers become redundant but stay in place as
// belt-and-braces until V-38-cleanup removes them.
//
// Two short-circuits keep the global guard from over-firing:
//
//   1. @Public() routes (login, webhooks, health, marketing). Reflector
//      reads the IS_PUBLIC_KEY metadata at handler and class scope —
//      same pattern as JwtAuthGuard.
//
//   2. Routes where TenantMiddleware deliberately skipped tenant context
//      population (/admin/*, /public/*, /booking/*, /health/*, /auth/*
//      — see PUBLIC_TENANT_PATHS in tenant.middleware.ts:41-47, and the
//      "no tenantId on JWT" branch at line 96). `request.tenant` is
//      undefined for these; the guard delegates the "is this route
//      tenant-bound?" decision to TenantMiddleware (single source of
//      truth) and steps aside.
//
// The actual security-relevant work — verifying the JWT's user has an
// ACTIVE TenantUser row linking them to the JWT's tenant — runs only
// when both `request.user` AND `request.tenant` are present, which is
// exactly the tenant-data-route case.
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // V-38 short-circuit #1: @Public() routes bypass entirely.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<
      Request & { tenant?: Tenant }
    >();
    const tenant = request.tenant;

    // V-38 short-circuit #2: TenantMiddleware decided this route doesn't
    // need tenant context (admin / pre-tenant / public-prefix paths).
    // Don't demand tenant membership where the request has no tenant
    // binding to check against.
    if (!tenant) return true;

    const user = request.user as JwtPayload | undefined;
    if (!user) {
      throw new ForbiddenException('غير مصرح بالوصول لهذا الحساب');
    }

    // Duplicate of TenantMiddleware's tenant.status check (V-14e-dry
    // tracks the cleanup). Retained here for explicit defense-in-depth
    // until that follow-up removes the duplication.
    if (tenant.status === 'suspended') {
      throw new ForbiddenException('حساب الصالون معلّق');
    }

    // V-01 refactor: extracted shared check so WsAuthGuard and the
    // HTTP TenantGuard agree on what "active tenant link" means.
    await assertActiveTenantUser(this.platformPrisma, tenant.id, user.sub);

    return true;
  }
}
