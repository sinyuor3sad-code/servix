#!/usr/bin/env ts-node
/**
 * Create a new tenant database
 * Usage: pnpm exec ts-node tooling/scripts/create-tenant.ts --nameAr "صالون النور" --nameEn "Nour Salon" [--slug nour-salon]
 *
 * Run from repo root. Requires: PLATFORM_DATABASE_URL in env
 * Creates: PostgreSQL database, runs tenant schema, seeds salon_info + default settings
 */

import { execSync } from 'child_process';
import { Client } from 'pg';
import * as path from 'path';

function parseArgs(): { nameAr: string; nameEn: string; slug?: string } {
  const args = process.argv.slice(2);
  const result: { nameAr?: string; nameEn?: string; slug?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--nameAr' && args[i + 1]) {
      result.nameAr = args[i + 1];
      i++;
    } else if (args[i] === '--nameEn' && args[i + 1]) {
      result.nameEn = args[i + 1];
      i++;
    } else if (args[i] === '--slug' && args[i + 1]) {
      result.slug = args[i + 1];
      i++;
    }
  }

  if (!result.nameAr || !result.nameEn) {
    console.error('Usage: ts-node create-tenant.ts --nameAr "الاسم بالعربي" --nameEn "Name in English" [--slug custom-slug]');
    process.exit(1);
  }

  return {
    nameAr: result.nameAr,
    nameEn: result.nameEn,
    slug: result.slug,
  };
}

function generateSlug(nameEn: string): string {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

function getBaseDbUrl(): URL {
  const url = process.env.PLATFORM_DATABASE_URL;
  if (!url) {
    console.error('PLATFORM_DATABASE_URL is required');
    process.exit(1);
  }
  return new URL(url);
}

async function createDatabase(dbName: string): Promise<void> {
  const baseUrl = getBaseDbUrl();
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  const exists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );

  if (exists.rows.length > 0) {
    console.log(`  Database ${dbName} already exists`);
    await client.end();
    return;
  }

  await client.query(`CREATE DATABASE "${dbName}"`);
  console.log(`  ✓ Created database: ${dbName}`);
  await client.end();
}

function runTenantMigrations(tenantDbUrl: string): void {
  const apiDir = path.resolve(__dirname, '../../apps/api');
  const schemaPath = path.join(apiDir, 'prisma/tenant.prisma');

  const env = { ...process.env, TENANT_DATABASE_URL: tenantDbUrl };
  execSync(
    `npx prisma db push --schema=${schemaPath} --accept-data-loss`,
    { cwd: apiDir, env, stdio: 'inherit' },
  );
  console.log('  ✓ Applied tenant schema');
}

async function seedTenantDb(
  tenantDbUrl: string,
  nameAr: string,
  nameEn: string,
): Promise<void> {
  const tenantPrismaPath = path.join(
    __dirname,
    '../../apps/api/node_modules/.prisma/tenant/index.js',
  );
  const { PrismaClient } = require(tenantPrismaPath);
  const prisma = new PrismaClient({
    datasources: { db: { url: tenantDbUrl } },
  });

  const existingSalon = await prisma.salonInfo.findFirst();
  if (existingSalon) {
    console.log('  Salon info already exists, skipping seed');
    await prisma.$disconnect();
    return;
  }

  await prisma.salonInfo.create({
    data: {
      nameAr,
      nameEn,
      openingTime: '09:00',
      closingTime: '22:00',
      slotDuration: 30,
      bufferTime: 10,
      currency: 'SAR',
      taxPercentage: 15,
      workingDays: {
        sat: { open: '09:00', close: '22:00' },
        sun: { open: '09:00', close: '22:00' },
        mon: { open: '09:00', close: '22:00' },
        tue: { open: '09:00', close: '22:00' },
        wed: { open: '09:00', close: '22:00' },
        thu: { open: '09:00', close: '22:00' },
        fri: { open: '14:00', close: '22:00' },
      },
    },
  });
  console.log('  ✓ Created salon_info');

  const defaultSettings = [
    { key: 'online_booking_enabled', value: 'true' },
    { key: 'auto_confirm_booking', value: 'false' },
    { key: 'booking_advance_days', value: '30' },
    { key: 'min_booking_notice_hours', value: '2' },
    { key: 'cancellation_deadline_hours', value: '12' },
    { key: 'max_daily_bookings', value: '0' },
    { key: 'walk_in_enabled', value: 'true' },
    { key: 'vacation_mode', value: 'false' },
    { key: 'vacation_message_ar', value: '' },
    { key: 'vacation_start_date', value: '' },
    { key: 'vacation_end_date', value: '' },
    { key: 'whatsapp_enabled', value: 'false' },
    { key: 'whatsapp_token', value: '' },
    { key: 'whatsapp_phone_number_id', value: '' },
    { key: 'whatsapp_business_name', value: '' },
    { key: 'whatsapp_verified', value: 'false' },
    { key: 'sms_enabled', value: 'false' },
    { key: 'email_enabled', value: 'true' },
    { key: 'whatsapp_booking_confirm', value: 'true' },
    { key: 'whatsapp_booking_reminder', value: 'true' },
    { key: 'whatsapp_invoice_send', value: 'true' },
    { key: 'whatsapp_review_request', value: 'true' },
    { key: 'loyalty_enabled', value: 'false' },
    { key: 'coupons_enabled', value: 'false' },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value },
    });
  }
  console.log(`  ✓ Created ${defaultSettings.length} default settings`);

  await prisma.$disconnect();
}

async function main(): Promise<void> {
  const { nameAr, nameEn, slug } = parseArgs();
  const dbSlug = slug || generateSlug(nameEn);
  const dbName = `servix_tenant_${dbSlug.replace(/-/g, '_')}`;

  console.log('\n=== Create Tenant Database ===');
  console.log(`  Name (AR): ${nameAr}`);
  console.log(`  Name (EN): ${nameEn}`);
  console.log(`  Database: ${dbName}\n`);

  const baseUrl = getBaseDbUrl();
  const tenantDbUrl = new URL(baseUrl);
  tenantDbUrl.pathname = `/${dbName}`;
  const tenantDbUrlStr = tenantDbUrl.toString();

  await createDatabase(dbName);
  runTenantMigrations(tenantDbUrlStr);
  await seedTenantDb(tenantDbUrlStr, nameAr, nameEn);

  console.log('\n✓ Tenant database ready.');
  console.log(`  Database name for platform: ${dbName}`);
  console.log(`  Connection: ${tenantDbUrlStr.replace(/:[^:@]+@/, ':****@')}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
