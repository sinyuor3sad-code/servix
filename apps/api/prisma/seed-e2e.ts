/**
 * E2E seed — bootstraps a complete, working salon environment for Playwright.
 *
 * What it produces (all idempotent — safe to re-run):
 *   • Platform seed (roles, permissions, plans, features, super-admin)
 *   • Test owner user      — servix@dev.local  / adsf1324  (verified)
 *   • Test cashier user    — cashier@dev.local / adsf1324  (verified)
 *   • Test tenant + active subscription on the Premium plan
 *   • A real tenant Postgres database with migrations deployed
 *   • Salon data:  SalonInfo, 3 categories, 8 services, 3 employees,
 *                  6 clients, 5 appointments, 2 invoices
 *
 * Why a separate seed: the production seed only sets up platform metadata.
 * E2E tests need a logged-in owner inside a real salon with realistic data
 * — running this as part of the platform seed would litter prod-like envs
 * with fixture rows.
 */
import { execSync } from 'child_process';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant';

const TEST_OWNER_EMAIL = process.env.TEST_EMAIL ?? 'servix@dev.local';
const TEST_OWNER_PASSWORD = process.env.TEST_PASSWORD ?? 'adsf1324';
const TEST_CASHIER_EMAIL = process.env.TEST_CASHIER_EMAIL ?? 'cashier@dev.local';
const TEST_CASHIER_PASSWORD = process.env.TEST_CASHIER_PASSWORD ?? 'adsf1324';
const TENANT_DB_NAME = process.env.E2E_TENANT_DB ?? 'tenant_e2e_test';
const TENANT_SLUG = 'e2e-test-salon';

const platform = new PlatformPrismaClient();

async function main(): Promise<void> {
  console.log('🌱 E2E seed starting...\n');

  // 1. Platform seed (roles/permissions/plans/features/super-admin) ─────────
  console.log('▶ Running platform seed (subprocess)...');
  execSync('npx ts-node prisma/seed.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });

  // 2. Test users ────────────────────────────────────────────────────────────
  console.log('\n▶ Creating test users...');
  const ownerPwHash = await bcrypt.hash(TEST_OWNER_PASSWORD, 12);
  const cashierPwHash = await bcrypt.hash(TEST_CASHIER_PASSWORD, 12);

  const owner = await platform.user.upsert({
    where: { email: TEST_OWNER_EMAIL },
    update: { passwordHash: ownerPwHash, isEmailVerified: true, isPhoneVerified: true },
    create: {
      fullName: 'مالك الاختبار',
      email: TEST_OWNER_EMAIL,
      phone: '+966500000001',
      passwordHash: ownerPwHash,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });
  console.log(`    ✓ owner: ${owner.email}`);

  const cashier = await platform.user.upsert({
    where: { email: TEST_CASHIER_EMAIL },
    update: { passwordHash: cashierPwHash, isEmailVerified: true, isPhoneVerified: true },
    create: {
      fullName: 'كاشير الاختبار',
      email: TEST_CASHIER_EMAIL,
      phone: '+966500000002',
      passwordHash: cashierPwHash,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });
  console.log(`    ✓ cashier: ${cashier.email}`);

  // 3. Test tenant ───────────────────────────────────────────────────────────
  console.log('\n▶ Creating test tenant...');
  const tenant = await platform.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: { databaseName: TENANT_DB_NAME, status: 'active' },
    create: {
      nameAr: 'صالون اختبار E2E',
      nameEn: 'E2E Test Salon',
      slug: TENANT_SLUG,
      phone: '+966550000000',
      email: 'salon@e2e.local',
      city: 'الرياض',
      databaseName: TENANT_DB_NAME,
      status: 'active',
    },
  });
  console.log(`    ✓ tenant: ${tenant.slug} (db: ${TENANT_DB_NAME})`);

  // Active Premium subscription so feature flags don't gate the UI
  const premiumPlan = await platform.plan.findUnique({ where: { name: 'Premium' } });
  if (premiumPlan) {
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 12);
    const existingSub = await platform.subscription.findFirst({
      where: { tenantId: tenant.id, status: 'active' },
    });
    if (!existingSub) {
      await platform.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: premiumPlan.id,
          status: 'active',
          billingCycle: 'yearly',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
      console.log('    ✓ Premium subscription created');
    } else {
      console.log('    ✓ Premium subscription already present');
    }
  }

  // 4. Link users to tenant ──────────────────────────────────────────────────
  console.log('\n▶ Linking users to tenant...');
  const ownerRole = await platform.role.findUnique({ where: { name: 'owner' } });
  const cashierRole = await platform.role.findUnique({ where: { name: 'cashier' } });
  if (!ownerRole || !cashierRole) {
    throw new Error('owner/cashier roles missing — platform seed did not run');
  }

  await platform.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: owner.id } },
    update: { roleId: ownerRole.id, isOwner: true, status: 'active' },
    create: { tenantId: tenant.id, userId: owner.id, roleId: ownerRole.id, isOwner: true },
  });
  await platform.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: cashier.id } },
    update: { roleId: cashierRole.id, status: 'active' },
    create: { tenantId: tenant.id, userId: cashier.id, roleId: cashierRole.id, isOwner: false },
  });
  console.log('    ✓ owner + cashier linked to tenant');

  // 5. Provision tenant database ─────────────────────────────────────────────
  console.log('\n▶ Provisioning tenant database...');
  await ensureTenantDatabase(TENANT_DB_NAME);
  await deployTenantMigrations(TENANT_DB_NAME);

  // 6. Seed salon data inside the tenant DB ──────────────────────────────────
  console.log('\n▶ Seeding salon data into tenant DB...');
  const tenantDbUrl = buildTenantUrl(TENANT_DB_NAME);
  const tenantDb = new TenantPrismaClient({ datasources: { db: { url: tenantDbUrl } } });
  try {
    await seedSalonData(tenantDb);
  } finally {
    await tenantDb.$disconnect();
  }

  console.log('\n✅ E2E seed complete.\n');
  console.log(`   Owner:   ${TEST_OWNER_EMAIL} / ${TEST_OWNER_PASSWORD}`);
  console.log(`   Cashier: ${TEST_CASHIER_EMAIL} / ${TEST_CASHIER_PASSWORD}`);
  console.log(`   Tenant:  ${tenant.nameEn} (${tenant.slug})\n`);
}

// ─── DB provisioning helpers ────────────────────────────────────────────────

function buildTenantUrl(databaseName: string): string {
  const base = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!base) throw new Error('PLATFORM_DATABASE_URL/DATABASE_URL not set');
  const url = new URL(base);
  // PgBouncer doesn't know about new DBs at runtime — go direct for migrations.
  if (url.hostname === 'pgbouncer') url.hostname = 'postgres';
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function ensureTenantDatabase(databaseName: string): Promise<void> {
  const safe = databaseName.replace(/[^a-zA-Z0-9_]/g, '');
  const existing = await platform.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM pg_database WHERE datname = $1`,
    safe,
  );
  if (Number(existing[0]?.count ?? 0) > 0) {
    console.log(`    ✓ database ${safe} already exists`);
    return;
  }
  await platform.$executeRawUnsafe(`CREATE DATABASE "${safe}"`);
  console.log(`    ✓ database ${safe} created`);
}

async function deployTenantMigrations(databaseName: string): Promise<void> {
  const tenantUrl = buildTenantUrl(databaseName);
  execSync('npx prisma migrate deploy --schema=./prisma/tenant.prisma', {
    cwd: process.cwd(),
    env: { ...process.env, TENANT_DATABASE_URL: tenantUrl },
    stdio: 'inherit',
  });
  console.log(`    ✓ migrations deployed to ${databaseName}`);
}

// ─── Salon data seed ────────────────────────────────────────────────────────

async function seedSalonData(db: TenantPrismaClient): Promise<void> {
  // Settings — mark onboarding complete so the dashboard guard doesn't
  // redirect the seeded owner to /onboarding during E2E.
  await db.setting.upsert({
    where: { key: 'onboarding_completed' },
    update: { value: 'true' },
    create: { key: 'onboarding_completed', value: 'true' },
  });
  console.log('    ✓ onboarding_completed=true');

  // SalonInfo (single row)
  const salonInfoCount = await db.salonInfo.count();
  if (salonInfoCount === 0) {
    await db.salonInfo.create({
      data: {
        nameAr: 'صالون اختبار E2E',
        nameEn: 'E2E Test Salon',
        phone: '+966550000000',
        email: 'salon@e2e.local',
        city: 'الرياض',
        address: 'شارع الاختبار، حي البرمجيات',
        currency: 'SAR',
        taxPercentage: 15,
        openingTime: '09:00',
        closingTime: '22:00',
      },
    });
    console.log('    ✓ SalonInfo created');
  } else {
    console.log('    ✓ SalonInfo already exists');
  }

  // Service categories (idempotent: skip if any exist)
  const existingCats = await db.serviceCategory.count();
  let cats: { id: string; nameAr: string }[] = [];
  if (existingCats === 0) {
    const created = await Promise.all([
      db.serviceCategory.create({ data: { nameAr: 'قص الشعر', nameEn: 'Hair', sortOrder: 1 } }),
      db.serviceCategory.create({ data: { nameAr: 'مكياج', nameEn: 'Makeup', sortOrder: 2 } }),
      db.serviceCategory.create({ data: { nameAr: 'أظافر', nameEn: 'Nails', sortOrder: 3 } }),
    ]);
    cats = created.map((c) => ({ id: c.id, nameAr: c.nameAr }));
    console.log(`    ✓ ${cats.length} categories created`);
  } else {
    cats = (await db.serviceCategory.findMany({ select: { id: true, nameAr: true } })).slice(0, 3);
    console.log(`    ✓ ${cats.length} categories already exist`);
  }

  // Services (8 across categories)
  const existingSvc = await db.service.count();
  if (existingSvc === 0 && cats.length >= 3) {
    await Promise.all([
      db.service.create({ data: { categoryId: cats[0].id, nameAr: 'قص أطراف', price: 80, duration: 30, sortOrder: 1 } }),
      db.service.create({ data: { categoryId: cats[0].id, nameAr: 'قص وفير', price: 150, duration: 60, sortOrder: 2 } }),
      db.service.create({ data: { categoryId: cats[0].id, nameAr: 'صبغ شعر', price: 350, duration: 120, sortOrder: 3 } }),
      db.service.create({ data: { categoryId: cats[1].id, nameAr: 'مكياج سهرة', price: 400, duration: 90, sortOrder: 1 } }),
      db.service.create({ data: { categoryId: cats[1].id, nameAr: 'مكياج عروس', price: 1500, duration: 180, sortOrder: 2 } }),
      db.service.create({ data: { categoryId: cats[2].id, nameAr: 'مناكير', price: 90, duration: 45, sortOrder: 1 } }),
      db.service.create({ data: { categoryId: cats[2].id, nameAr: 'باديكير', price: 120, duration: 60, sortOrder: 2 } }),
      db.service.create({ data: { categoryId: cats[2].id, nameAr: 'تركيب أظافر', price: 250, duration: 90, sortOrder: 3 } }),
    ]);
    console.log('    ✓ 8 services created');
  } else {
    console.log(`    ✓ ${existingSvc} services already exist`);
  }

  // Employees
  const existingEmp = await db.employee.count();
  let employees: { id: string }[] = [];
  if (existingEmp === 0) {
    employees = await Promise.all([
      db.employee.create({ data: { fullName: 'سارة الأحمد', phone: '+966551111111', role: 'stylist', commissionType: 'percentage', commissionValue: 30, salary: 5000 } }),
      db.employee.create({ data: { fullName: 'منى السالم', phone: '+966552222222', role: 'makeup', commissionType: 'percentage', commissionValue: 35, salary: 6000 } }),
      db.employee.create({ data: { fullName: 'هدى المطيري', phone: '+966553333333', role: 'nails', commissionType: 'percentage', commissionValue: 25, salary: 4500 } }),
    ]);
    console.log(`    ✓ ${employees.length} employees created`);
  } else {
    employees = await db.employee.findMany({ select: { id: true } });
    console.log(`    ✓ ${employees.length} employees already exist`);
  }

  // Clients
  const existingClients = await db.client.count();
  let clients: { id: string }[] = [];
  if (existingClients === 0) {
    clients = await Promise.all([
      db.client.create({ data: { fullName: 'نورة العتيبي', phone: '+966561111111', email: 'noura@example.com', gender: 'female' } }),
      db.client.create({ data: { fullName: 'فاطمة الزهراني', phone: '+966562222222', gender: 'female' } }),
      db.client.create({ data: { fullName: 'عائشة الشمري', phone: '+966563333333', email: 'aisha@example.com', gender: 'female' } }),
      db.client.create({ data: { fullName: 'ريم القحطاني', phone: '+966564444444', gender: 'female' } }),
      db.client.create({ data: { fullName: 'سلمى الدوسري', phone: '+966565555555', gender: 'female' } }),
      db.client.create({ data: { fullName: 'لينا الحربي', phone: '+966566666666', gender: 'female' } }),
    ]);
    console.log(`    ✓ ${clients.length} clients created`);
  } else {
    clients = await db.client.findMany({ select: { id: true } });
    console.log(`    ✓ ${clients.length} clients already exist`);
  }

  // Appointments (a mix of statuses across the next week)
  const existingAppt = await db.appointment.count();
  if (existingAppt === 0 && clients.length >= 5 && employees.length >= 3) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inDays = (d: number) => {
      const x = new Date(today);
      x.setDate(x.getDate() + d);
      return x;
    };
    await Promise.all([
      db.appointment.create({ data: { clientId: clients[0].id, employeeId: employees[0].id, date: inDays(1), startTime: '10:00', endTime: '11:00', status: 'confirmed', totalPrice: 150, totalDuration: 60 } }),
      db.appointment.create({ data: { clientId: clients[1].id, employeeId: employees[1].id, date: inDays(1), startTime: '14:00', endTime: '15:30', status: 'pending', totalPrice: 400, totalDuration: 90 } }),
      db.appointment.create({ data: { clientId: clients[2].id, employeeId: employees[2].id, date: inDays(2), startTime: '11:00', endTime: '12:30', status: 'confirmed', totalPrice: 250, totalDuration: 90 } }),
      db.appointment.create({ data: { clientId: clients[3].id, employeeId: employees[0].id, date: inDays(3), startTime: '13:00', endTime: '15:00', status: 'completed', totalPrice: 350, totalDuration: 120 } }),
      db.appointment.create({ data: { clientId: clients[4].id, employeeId: employees[1].id, date: inDays(0), startTime: '16:00', endTime: '17:00', status: 'cancelled', totalPrice: 80, totalDuration: 60 } }),
    ]);
    console.log('    ✓ 5 appointments created');
  } else {
    console.log(`    ✓ ${existingAppt} appointments already exist`);
  }

  // Invoices (2 — one paid, one draft)
  const existingInv = await db.invoice.count();
  if (existingInv === 0 && clients.length >= 2) {
    // We need a created-by user id; the owner's UUID lives on the platform DB.
    // Just look it up from platform — same email → same uuid.
    const ownerOnPlatform = await platform.user.findUnique({ where: { email: TEST_OWNER_EMAIL } });
    if (ownerOnPlatform) {
      await db.invoice.create({
        data: {
          clientId: clients[0].id,
          invoiceNumber: 'E2E-INV-000001',
          subtotal: 150,
          taxAmount: 22.5,
          total: 172.5,
          status: 'paid',
          createdBy: ownerOnPlatform.id,
          paidAt: new Date(),
        },
      });
      await db.invoice.create({
        data: {
          clientId: clients[1].id,
          invoiceNumber: 'E2E-INV-000002',
          subtotal: 400,
          taxAmount: 60,
          total: 460,
          status: 'draft',
          createdBy: ownerOnPlatform.id,
        },
      });
      console.log('    ✓ 2 invoices created');
    }
  } else {
    console.log(`    ✓ ${existingInv} invoices already exist`);
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

main()
  .catch((e) => {
    console.error('\n❌ E2E seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await platform.$disconnect();
  });
