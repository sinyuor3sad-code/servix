#!/bin/bash
# SERVIX — Developer Setup Script

set -e

echo "🚀 إعداد مشروع SERVIX..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required. Install: npm install -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required"; exit 1; }

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo "🐳 Starting Docker services..."
docker compose -f tooling/docker/docker-compose.yml up -d

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
sleep 5

# Setup environment
if [ ! -f apps/api/.env ]; then
  cp .env.example apps/api/.env
  echo "📝 Created apps/api/.env from .env.example"
fi

# Generate Prisma clients
echo "🔧 Generating Prisma clients..."
cd apps/api
npx prisma generate --schema=./prisma/platform.prisma
npx prisma generate --schema=./prisma/tenant.prisma

# Run migrations
echo "🗃️ Running database migrations..."
npx prisma migrate dev --schema=./prisma/platform.prisma --name init

# Seed database
echo "🌱 Seeding database..."
npx ts-node prisma/seed.ts

cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start development servers:"
echo "  pnpm dev              — Start all apps"
echo "  pnpm --filter @servix/api dev    — API only (http://localhost:4000)"
echo "  pnpm --filter @servix/dashboard dev — Dashboard (http://localhost:3000)"
echo ""
echo "Useful commands:"
echo "  pnpm docker:up        — Start Docker services"
echo "  pnpm docker:down      — Stop Docker services"
echo "  pnpm type-check       — Type check all apps"
echo "  pnpm test             — Run tests"
echo ""
echo "📖 API docs: http://localhost:4000/docs"
echo "🎨 Dashboard: http://localhost:3000"
echo "📅 Booking: http://localhost:3001"
echo "⚙️ Admin: http://localhost:3002"
