import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { EmployeesController } from '../src/modules/salon/employees/employees.controller';
import { EmployeesService } from '../src/modules/salon/employees/employees.service';
import { PermissionGuard } from '../src/shared/guards/permission.guard';
import { TenantGuard } from '../src/shared/guards/tenant.guard';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { CacheService } from '../src/shared/cache/cache.service';

/**
 * V-123b — GOLD PROOF: permission enforcement on the REAL EmployeesController.
 *
 * Uses the actual controller + actual @RequirePermission decorators + the real
 * PermissionGuard wired as a GLOBAL APP_GUARD (no @UseGuards(PermissionGuard) on
 * the controller — proves the global registration enforces). TenantGuard is
 * overridden to isolate the permission decision; EmployeesService is mocked so
 * the allowed (200) path returns without a tenant DB. The role→permission sets
 * mirror prisma/seed.ts exactly (owner=all, cashier/staff/receptionist curated).
 *
 * The owner's gold scenario: cashier → DELETE /employees/:id = 403, owner = 200.
 */

const UUID = '11111111-1111-1111-1111-111111111111';

// Mirrors prisma/seed.ts role_permissions (only the codes these tests assert).
const ROLE_PERMS: Record<string, { name: string; codes: string[] }> = {
  'r-owner': {
    name: 'owner',
    codes: [
      'employees.view', 'employees.create', 'employees.update',
      'employees.delete', 'employees.schedule', 'settings.users',
    ],
  },
  'r-receptionist': {
    name: 'receptionist',
    // seed: receptionist has employees.view (read) but no create/update/delete
    codes: ['employees.view', 'clients.view', 'appointments.view'],
  },
  'r-cashier': {
    name: 'cashier',
    // seed: cashier has NO employees.* codes
    codes: ['invoices.view', 'invoices.create', 'payments.create', 'coupons.view'],
  },
  'r-staff': {
    name: 'staff',
    codes: ['appointments.view', 'clients.view', 'services.view'],
  },
  'r-super': { name: 'super_admin', codes: [] },
};

describe('V-123b — employees permission enforcement (gold proof, real controller)', () => {
  let app: INestApplication;

  const employeesService = {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'emp-1' }),
    deactivate: jest.fn().mockResolvedValue({ id: 'emp-1', deleted: true }),
  };
  const cache = {
    getJson: jest.fn((key: string) => {
      const roleId = key.replace('servix:rbac:role_perms:', '');
      return Promise.resolve(ROLE_PERMS[roleId] ?? null);
    }),
    setJson: jest.fn().mockResolvedValue(undefined),
  };
  const allowTenantGuard: CanActivate = { canActivate: () => true };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        { provide: EmployeesService, useValue: employeesService },
        { provide: PlatformPrismaClient, useValue: { role: { findUnique: jest.fn() } } },
        { provide: CacheService, useValue: cache },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    })
      .overrideGuard(TenantGuard)
      .useValue(allowTenantGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI }); // controller is version:'1'
    // Stand in for JwtAuthGuard + TenantMiddleware: populate user + tenant.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const roleId = req.headers['x-role-id'];
      const r = req as Request & {
        user?: { sub: string; roleId: string };
        tenant?: { id: string; status: string };
        tenantDb?: unknown;
      };
      if (typeof roleId === 'string') r.user = { sub: 'u-1', roleId };
      r.tenant = { id: 't-1', status: 'active' };
      r.tenantDb = {};
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const as = (method: 'get' | 'post' | 'delete', path: string, roleId?: string) => {
    const r = request(app.getHttpServer())[method](path);
    return roleId ? r.set('x-role-id', roleId) : r;
  };

  describe('DELETE /employees/:id requires employees.delete', () => {
    it('cashier (no employees.*) → 403 [GOLD]', () =>
      as('delete', `/v1/employees/${UUID}`, 'r-cashier').expect(403));
    it('staff → 403', () =>
      as('delete', `/v1/employees/${UUID}`, 'r-staff').expect(403));
    it('receptionist (view only) → 403', () =>
      as('delete', `/v1/employees/${UUID}`, 'r-receptionist').expect(403));
    it('owner → 200 [GOLD]', () =>
      as('delete', `/v1/employees/${UUID}`, 'r-owner').expect(200));
    it('super_admin → 200 (bypass)', () =>
      as('delete', `/v1/employees/${UUID}`, 'r-super').expect(200));
    it('no token → 403', () =>
      as('delete', `/v1/employees/${UUID}`).expect(403));
  });

  describe('GET /employees requires employees.view', () => {
    it('cashier → 403', () => as('get', '/v1/employees', 'r-cashier').expect(403));
    it('staff → 403', () => as('get', '/v1/employees', 'r-staff').expect(403));
    it('receptionist (has employees.view) → 200', () =>
      as('get', '/v1/employees', 'r-receptionist').expect(200));
    it('owner → 200', () => as('get', '/v1/employees', 'r-owner').expect(200));
  });

  describe('POST /employees requires employees.create', () => {
    it('receptionist (view only) → 403', () =>
      as('post', '/v1/employees', 'r-receptionist').expect(403));
    it('owner → 201', () =>
      as('post', '/v1/employees', 'r-owner').expect(201));
  });
});
