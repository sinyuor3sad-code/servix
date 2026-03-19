// Database Setup Script
// Run after Docker containers are up:
//   1. docker compose -f tooling/docker/docker-compose.yml up -d
//   2. cd apps/api
//   3. npx prisma migrate dev --schema=prisma/platform.prisma --name init
//   4. npx prisma migrate dev --schema=prisma/tenant.prisma --name init
//   5. npx ts-node prisma/seed.ts
//
// Or from the project root:
//   pnpm docker:up
//   pnpm db:migrate
//   pnpm db:seed

console.log(`
═══════════════════════════════════════════════════
  SERVIX — Database Setup
═══════════════════════════════════════════════════

Prerequisites:
  1. Docker Desktop must be running
  2. Run: pnpm docker:up

Steps:
  1. cd apps/api
  2. npx prisma migrate dev --schema=prisma/platform.prisma --name init
  3. npx prisma migrate dev --schema=prisma/tenant.prisma --name init
  4. npx ts-node prisma/seed.ts

This will:
  • Create the platform database tables (12 tables)
  • Create the tenant template database tables (16 tables)
  • Seed roles, permissions, plans, features, and admin user
═══════════════════════════════════════════════════
`);
