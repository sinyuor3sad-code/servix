import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { InvoicesController } from '../src/modules/salon/invoices/invoices.controller';
import { InvoicesService } from '../src/modules/salon/invoices/invoices.service';
import { DebtsController } from '../src/modules/salon/debts/debts.controller';
import { DebtsService } from '../src/modules/salon/debts/debts.service';
import { PermissionGuard } from '../src/shared/guards/permission.guard';
import { TenantGuard } from '../src/shared/guards/tenant.guard';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { CacheService } from '../src/shared/cache/cache.service';

/**
 * V-123c — GOLD PROOF: money enforcement on the REAL InvoicesController +
 * DebtsController (same harness as the V-123b employees gold proof: real
 * controllers + real @RequirePermission decorators + real PermissionGuard as
 * GLOBAL APP_GUARD; TenantGuard overridden, services mocked).
 *
 * The launch-risk scenario this closes: cashier could void invoices and erase
 * debts with no authorization at all. Now:
 *   - void          → invoices.void   (owner/manager only)
 *   - debt deletion → invoices.void   (write-off semantics — owner/manager only)
 *   - refund        → payments.refund (cashier KEEPS it per seed — owner
 *     decision 2026-06-10: wiring only, no policy change; staff/receptionist 403)
 *
 * The role→permission sets mirror prisma/seed.ts exactly.
 */

const UUID = '11111111-1111-1111-1111-111111111111';

// Mirrors prisma/seed.ts role_permissions (only the codes these tests assert).
const ROLE_PERMS: Record<string, { name: string; codes: string[] }> = {
  'r-owner': {
    name: 'owner',
    codes: [
      'invoices.view', 'invoices.create', 'invoices.update', 'invoices.void',
      'invoices.discount', 'payments.view', 'payments.create', 'payments.refund',
    ],
  },
  'r-manager': {
    // seed: manager = all permissions except settings.subscription
    name: 'manager',
    codes: [
      'invoices.view', 'invoices.create', 'invoices.update', 'invoices.void',
      'invoices.discount', 'payments.view', 'payments.create', 'payments.refund',
    ],
  },
  'r-receptionist': {
    name: 'receptionist',
    // seed: view/create only — no update/void/discount/refund
    codes: ['invoices.view', 'invoices.create', 'payments.view', 'payments.create'],
  },
  'r-cashier': {
    name: 'cashier',
    // seed: NO invoices.void; HAS payments.refund + invoices.discount
    codes: [
      'invoices.view', 'invoices.create', 'invoices.update', 'invoices.discount',
      'payments.view', 'payments.create', 'payments.refund', 'coupons.view',
    ],
  },
  'r-staff': {
    name: 'staff',
    codes: ['appointments.view', 'clients.view', 'services.view'],
  },
  'r-super': { name: 'super_admin', codes: [] },
};

describe('V-123c — money permission enforcement (gold proof, real controllers)', () => {
  let app: INestApplication;

  const invoicesService = {
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    voidInvoice: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'voided' }),
    refundInvoice: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'refunded' }),
    recordPayment: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    addDiscount: jest.fn().mockResolvedValue({ id: 'inv-1' }),
  };
  const debtsService = {
    deleteClientDebt: jest.fn().mockResolvedValue({ deleted: true }),
    deleteEmployeeDebt: jest.fn().mockResolvedValue({ deleted: true }),
    createClientDebt: jest.fn().mockResolvedValue({ id: 'debt-1' }),
    getSummary: jest.fn().mockResolvedValue({ total: 0 }),
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
      controllers: [InvoicesController, DebtsController],
      providers: [
        { provide: InvoicesService, useValue: invoicesService },
        { provide: DebtsService, useValue: debtsService },
        { provide: PlatformPrismaClient, useValue: { role: { findUnique: jest.fn() } } },
        { provide: CacheService, useValue: cache },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    })
      .overrideGuard(TenantGuard)
      .useValue(allowTenantGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI }); // controllers are version:'1'
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

  const as = (method: 'get' | 'post' | 'put' | 'delete', path: string, roleId?: string) => {
    const r = request(app.getHttpServer())[method](path);
    return roleId ? r.set('x-role-id', roleId) : r;
  };

  describe('PUT /invoices/:id/void requires invoices.void', () => {
    it('cashier (no invoices.void) → 403 [GOLD]', () =>
      as('put', `/v1/invoices/${UUID}/void`, 'r-cashier').expect(403));
    it('receptionist → 403', () =>
      as('put', `/v1/invoices/${UUID}/void`, 'r-receptionist').expect(403));
    it('staff → 403', () =>
      as('put', `/v1/invoices/${UUID}/void`, 'r-staff').expect(403));
    it('manager → 200 [GOLD]', () =>
      as('put', `/v1/invoices/${UUID}/void`, 'r-manager').expect(200));
    it('owner → 200 [GOLD]', () =>
      as('put', `/v1/invoices/${UUID}/void`, 'r-owner').expect(200));
    it('super_admin → 200 (bypass)', () =>
      as('put', `/v1/invoices/${UUID}/void`, 'r-super').expect(200));
    it('no token → 403', () =>
      as('put', `/v1/invoices/${UUID}/void`).expect(403));
  });

  describe('POST /invoices/:id/refund requires payments.refund', () => {
    it('staff → 403', () =>
      as('post', `/v1/invoices/${UUID}/refund`, 'r-staff').expect(403));
    it('receptionist (no refund) → 403', () =>
      as('post', `/v1/invoices/${UUID}/refund`, 'r-receptionist').expect(403));
    // .send({...}) needed: this controller method reads dto.reason/dto.itemIds,
    // so the request must carry a JSON body for the allowed (2xx) path.
    it('cashier → 201 (seed grants payments.refund — policy kept, owner decision 2026-06-10)', () =>
      as('post', `/v1/invoices/${UUID}/refund`, 'r-cashier').send({ reason: 'test' }).expect(201));
    it('manager → 201', () =>
      as('post', `/v1/invoices/${UUID}/refund`, 'r-manager').send({ reason: 'test' }).expect(201));
  });

  describe('POST /invoices/:id/pay requires payments.create', () => {
    it('staff → 403', () =>
      as('post', `/v1/invoices/${UUID}/pay`, 'r-staff').expect(403));
    it('cashier → 201', () =>
      as('post', `/v1/invoices/${UUID}/pay`, 'r-cashier').expect(201));
    it('receptionist → 201', () =>
      as('post', `/v1/invoices/${UUID}/pay`, 'r-receptionist').expect(201));
  });

  describe('POST /invoices/:id/discount requires invoices.discount', () => {
    it('receptionist (no discount) → 403', () =>
      as('post', `/v1/invoices/${UUID}/discount`, 'r-receptionist').expect(403));
    it('cashier → 201', () =>
      as('post', `/v1/invoices/${UUID}/discount`, 'r-cashier').expect(201));
  });

  describe('GET /invoices requires invoices.view', () => {
    it('staff → 403', () => as('get', '/v1/invoices', 'r-staff').expect(403));
    it('cashier → 200', () => as('get', '/v1/invoices', 'r-cashier').expect(200));
  });

  describe('DELETE /debts/clients/:id requires invoices.void (write-off)', () => {
    it('cashier → 403 [GOLD]', () =>
      as('delete', `/v1/debts/clients/${UUID}`, 'r-cashier').expect(403));
    it('receptionist → 403', () =>
      as('delete', `/v1/debts/clients/${UUID}`, 'r-receptionist').expect(403));
    it('owner → 200 [GOLD]', () =>
      as('delete', `/v1/debts/clients/${UUID}`, 'r-owner').expect(200));
  });

  describe('POST /debts/clients requires payments.create', () => {
    it('staff → 403', () =>
      as('post', '/v1/debts/clients', 'r-staff').expect(403));
    it('receptionist → 201', () =>
      as('post', '/v1/debts/clients', 'r-receptionist').expect(201));
  });
});
