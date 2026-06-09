import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../src/shared/decorators/require-permission.decorator';
import { EmployeesController } from '../src/modules/salon/employees/employees.controller';
import { ServicesController } from '../src/modules/salon/services/services.controller';
import { ClientsController } from '../src/modules/salon/clients/clients.controller';
import { AppointmentsController } from '../src/modules/salon/appointments/appointments.controller';
import { ReportsController } from '../src/modules/salon/reports/reports.controller';
import { CouponsController } from '../src/modules/salon/coupons/coupons.controller';
import { ExpensesController } from '../src/modules/salon/expenses/expenses.controller';
import { LoyaltyController } from '../src/modules/salon/loyalty/loyalty.controller';
import { AttendanceController } from '../src/modules/salon/attendance/attendance.controller';
import { SettingsController } from '../src/modules/salon/settings/settings.controller';
import { SalonInfoController } from '../src/modules/salon/salon-info/salon-info.controller';

/**
 * V-123b — per-route guard: every @RequirePermission code applied to a wired
 * controller MUST be a code seeded in prisma/seed.ts. A typo'd / non-seeded code
 * is held by no role, so every non-super_admin would get 403 — a silent outage.
 * This reflects the REAL decorators on the REAL controllers, so dropping or
 * mis-typing one fails here. Complements the runtime gold proof
 * (rbac-employees-enforcement.e2e-spec.ts).
 */

// Source of truth: prisma/seed.ts permissionData codes.
const SEEDED_CODES = new Set<string>([
  'appointments.view', 'appointments.create', 'appointments.update', 'appointments.delete', 'appointments.status',
  'clients.view', 'clients.create', 'clients.update', 'clients.delete',
  'employees.view', 'employees.create', 'employees.update', 'employees.delete', 'employees.schedule',
  'services.view', 'services.create', 'services.update', 'services.delete',
  'invoices.view', 'invoices.create', 'invoices.update', 'invoices.void', 'invoices.discount',
  'payments.view', 'payments.create', 'payments.refund',
  'reports.view', 'reports.export',
  'coupons.view', 'coupons.create', 'coupons.update', 'coupons.delete',
  'loyalty.view', 'loyalty.adjust',
  'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete',
  'settings.view', 'settings.update', 'settings.users', 'settings.branding', 'settings.subscription',
  'attendance.view', 'attendance.manage',
]);

const WIRED_CONTROLLERS = [
  EmployeesController, ServicesController, ClientsController, AppointmentsController,
  ReportsController, CouponsController, ExpensesController, LoyaltyController,
  AttendanceController, SettingsController, SalonInfoController,
];

function gatedRoutes(
  controller: new (...args: never[]) => object,
  reflector: Reflector,
): { method: string; code: string }[] {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((m) => m !== 'constructor' && typeof proto[m] === 'function')
    .map((m) => ({
      method: m,
      code: reflector.get<string>(PERMISSION_KEY, proto[m] as (...a: never[]) => unknown),
    }))
    .filter((r): r is { method: string; code: string } => Boolean(r.code));
}

describe('V-123b — @RequirePermission codes are all seeded', () => {
  const reflector = new Reflector();
  const all = WIRED_CONTROLLERS.flatMap((c) =>
    gatedRoutes(c, reflector).map((r) => ({ controller: c.name, ...r })),
  );

  it('wires a meaningful number of routes (decorators did not silently vanish)', () => {
    expect(all.length).toBeGreaterThanOrEqual(60);
  });

  it.each(all)('$controller.$method requires seeded code "$code"', ({ code }) => {
    expect(SEEDED_CODES.has(code)).toBe(true);
  });

  it('the gold-path mutations carry the expected codes', () => {
    const codeOf = (c: new (...args: never[]) => object, m: string) =>
      new Reflector().get<string>(PERMISSION_KEY, (c.prototype as Record<string, unknown>)[m] as (...a: never[]) => unknown);
    expect(codeOf(EmployeesController, 'deactivate')).toBe('employees.delete');
    expect(codeOf(ServicesController, 'hardDelete')).toBe('services.delete');
    expect(codeOf(ClientsController, 'softDelete')).toBe('clients.delete');
    expect(codeOf(AppointmentsController, 'changeStatus')).toBe('appointments.status');
    expect(codeOf(CouponsController, 'remove')).toBe('coupons.delete');
    expect(codeOf(ExpensesController, 'remove')).toBe('expenses.delete');
  });
});
