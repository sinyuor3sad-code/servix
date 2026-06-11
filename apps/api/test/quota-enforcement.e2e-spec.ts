import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { EmployeesController } from '../src/modules/salon/employees/employees.controller';
import { EmployeesService } from '../src/modules/salon/employees/employees.service';
import { ClientDnaController } from '../src/modules/salon/client-dna/client-dna.controller';
import { ClientDnaService } from '../src/modules/salon/client-dna/client-dna.service';
import { QuotaGuard } from '../src/shared/guards/quota.guard';
import { TenantGuard } from '../src/shared/guards/tenant.guard';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { CacheService } from '../src/shared/cache/cache.service';

/**
 * V-37-wire — GOLD PROOF: plan-quota enforcement on the REAL
 * EmployeesController (same harness family as the V-123 gold proofs: real
 * controller + real @QuotaResource decorator + the real QuotaGuard wired as a
 * GLOBAL APP_GUARD; TenantGuard overridden, EmployeesService mocked, plan
 * limits served by a stubbed PlatformPrismaClient).
 *
 * Pre-wire, QuotaGuard was registered nowhere: every tenant on every plan
 * could create unlimited resources. This proves the global registration
 * enforces the DB-backed plan limit (403 QUOTA_EXCEEDED at the cap) and that
 * V-37c metadata — not controller-name matching — selects what is gated
 * (ClientDnaController POST stays un-gated despite "Client" in its name).
 */

const employeeCount = jest.fn();
const clientCount = jest.fn();
const PLAN: { maxEmployees: number; maxClients: number; maxAppointmentsMonth: number | null } =
  { maxEmployees: 5, maxClients: 100, maxAppointmentsMonth: null };
let subscriptionRow: { plan: typeof PLAN } | null = { plan: PLAN };

describe('V-37-wire — quota enforcement (gold proof, real controller)', () => {
  let app: INestApplication;

  const employeesService = {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'emp-1' }),
  };
  const clientDnaService = {
    computeForAllClients: jest.fn().mockResolvedValue(0),
  };
  const prisma = {
    subscription: {
      findFirst: jest.fn(() => Promise.resolve(subscriptionRow)),
    },
  };
  const cache = {
    getJson: jest.fn().mockResolvedValue(null), // always miss → exercise DB path
    setJson: jest.fn().mockResolvedValue(undefined),
  };
  const allowTenantGuard: CanActivate = { canActivate: () => true };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController, ClientDnaController],
      providers: [
        { provide: EmployeesService, useValue: employeesService },
        { provide: ClientDnaService, useValue: clientDnaService },
        { provide: PlatformPrismaClient, useValue: prisma },
        { provide: CacheService, useValue: cache },
        // The ONLY wiring of QuotaGuard — global, no @UseGuards anywhere.
        { provide: APP_GUARD, useClass: QuotaGuard },
      ],
    })
      .overrideGuard(TenantGuard)
      .useValue(allowTenantGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI }); // controllers are version:'1'
    // Stand in for JwtAuthGuard + TenantMiddleware: populate user/tenant/tenantDb.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const r = req as Request & {
        user?: { sub: string; tenantId: string };
        tenant?: { id: string; status: string };
        tenantDb?: unknown;
      };
      r.user = { sub: 'u-1', tenantId: 't-1' };
      r.tenant = { id: 't-1', status: 'active' };
      r.tenantDb = {
        employee: { count: employeeCount },
        client: { count: clientCount },
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    subscriptionRow = { plan: { ...PLAN } };
    employeeCount.mockReset();
  });

  it('POST /employees AT the plan limit → 403 QUOTA_EXCEEDED [GOLD]', async () => {
    employeeCount.mockResolvedValue(5); // usage == maxEmployees(5)
    const res = await request(app.getHttpServer()).post('/v1/employees').send({});
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('QUOTA_EXCEEDED');
    expect(employeesService.create).not.toHaveBeenCalled();
  });

  it('POST /employees UNDER the plan limit → 201 [GOLD]', async () => {
    employeeCount.mockResolvedValue(4);
    await request(app.getHttpServer()).post('/v1/employees').send({}).expect(201);
  });

  it('GET /employees is never quota-checked (even at the cap)', async () => {
    employeeCount.mockResolvedValue(5);
    await request(app.getHttpServer()).get('/v1/employees').expect(200);
  });

  it('unlimited plan (maxEmployees = -1) → 201 regardless of usage', async () => {
    subscriptionRow = { plan: { ...PLAN, maxEmployees: -1 } };
    employeeCount.mockResolvedValue(99999);
    await request(app.getHttpServer()).post('/v1/employees').send({}).expect(201);
  });

  it('no subscription/plan → pass-through 201 (fail-open, V-37d)', async () => {
    subscriptionRow = null;
    employeeCount.mockResolvedValue(99999);
    await request(app.getHttpServer()).post('/v1/employees').send({}).expect(201);
  });

  it('V-37c: ClientDnaController POST is NOT gated despite matching "client" (old name-matching would 403 here)', async () => {
    // Clients quota exhausted: usage 999 >= maxClients 100. The DNA compute
    // route lives under path 'clients' AND its class name contains "Client" —
    // pre-V-37c detectResource() would have counted it against the clients
    // quota and blocked it. Explicit @QuotaResource metadata leaves it open.
    clientCount.mockResolvedValue(999);
    await request(app.getHttpServer()).post('/v1/clients/dna/compute-all').send({}).expect(201);
    expect(clientDnaService.computeForAllClients).toHaveBeenCalled();
    expect(clientCount).not.toHaveBeenCalled(); // quota never consulted
  });
});
