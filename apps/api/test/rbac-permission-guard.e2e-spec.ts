import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { PermissionGuard } from '../src/shared/guards/permission.guard';
import { RequirePermission } from '../src/shared/decorators/require-permission.decorator';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { CacheService } from '../src/shared/cache/cache.service';

/**
 * V-123a — RUNTIME proof that PermissionGuard is enforced as a GLOBAL APP_GUARD.
 *
 * TestController below carries @RequirePermission on `/rbac-test/protected` but
 * NO @UseGuards(PermissionGuard). The guard is wired ONLY via
 * { provide: APP_GUARD, useClass: PermissionGuard } — exactly as in
 * app.module.ts. Therefore a real HTTP 403 here can only be produced by the
 * GLOBAL registration executing the guard. If a regression drops the APP_GUARD
 * line, `/protected` returns 200 for everyone and the 403 assertions fail —
 * this is the test that catches the "inert guard" trap that left @Roles dead on
 * RolesController.
 *
 * req.user is injected by a tiny middleware reading `x-role-id` (standing in for
 * JwtAuthGuard, which is not part of this minimal module). CacheService is
 * stubbed to always miss so every request exercises the real DB-lookup path via
 * the stubbed PlatformPrismaClient.
 */

@Controller('rbac-test')
class RbacTestController {
  @Get('protected')
  @RequirePermission('employees.delete')
  protected(): { ok: true } {
    return { ok: true };
  }

  @Get('open')
  open(): { ok: true } {
    return { ok: true };
  }
}

// Stands in for JwtAuthGuard/passport: sets request.user.roleId from a header.
@Injectable()
class TestUserMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const roleId = req.headers['x-role-id'];
    if (typeof roleId === 'string' && roleId.length > 0) {
      (req as Request & { user?: { roleId: string } }).user = { roleId };
    }
    next();
  }
}

// roleId → DB shape returned by role.findUnique({ include: rolePermissions }).
const ROLE_DB: Record<
  string,
  { name: string; rolePermissions: { permission: { code: string } }[] } | null
> = {
  'owner-role': {
    name: 'owner',
    rolePermissions: [
      { permission: { code: 'employees.delete' } },
      { permission: { code: 'clients.view' } },
    ],
  },
  'cashier-role': {
    name: 'cashier',
    rolePermissions: [
      { permission: { code: 'invoices.create' } },
      { permission: { code: 'payments.create' } },
    ],
  },
  'super-role': { name: 'super_admin', rolePermissions: [] },
  'ghost-role': null,
};

describe('V-123a — PermissionGuard global APP_GUARD (runtime HTTP proof)', () => {
  let app: INestApplication;

  const mockCache = {
    getJson: jest.fn().mockResolvedValue(null), // always miss → exercise DB path
    setJson: jest.fn().mockResolvedValue(undefined),
  };
  const mockPrisma = {
    role: {
      findUnique: jest.fn(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(ROLE_DB[where.id] ?? null),
      ),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RbacTestController],
      providers: [
        Reflector,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        // The ONLY wiring of PermissionGuard — global, no @UseGuards anywhere.
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, res: Response, next: NextFunction) =>
      new TestUserMiddleware().use(req, res, next),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (path: string, roleId?: string) => {
    const r = request(app.getHttpServer()).get(path);
    return roleId ? r.set('x-role-id', roleId) : r;
  };

  it('protected route + role WITHOUT the permission → 403 (proves global guard ran)', async () => {
    await get('/rbac-test/protected', 'cashier-role').expect(403);
  });

  it('protected route + role WITH the permission → 200', async () => {
    await get('/rbac-test/protected', 'owner-role').expect(200);
  });

  it('protected route + super_admin → 200 (name bypass, empty codes)', async () => {
    await get('/rbac-test/protected', 'super-role').expect(200);
  });

  it('protected route + no roleId → 403', async () => {
    await get('/rbac-test/protected').expect(403);
  });

  it('protected route + unknown role → 403', async () => {
    await get('/rbac-test/protected', 'ghost-role').expect(403);
  });

  it('open route (no @RequirePermission) → 200 even with no user (pass-through)', async () => {
    await get('/rbac-test/open').expect(200);
  });

  it('open route + a role lacking everything → still 200 (unprotected routes unaffected)', async () => {
    await get('/rbac-test/open', 'cashier-role').expect(200);
  });
});
