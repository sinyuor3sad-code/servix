# SERVIX — Developer Setup Script (Windows PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "`n`e[36m🚀 إعداد مشروع SERVIX...`e[0m`n"

# Check prerequisites
function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "node")) {
    Write-Host "❌ Node.js is required. Download: https://nodejs.org" -ForegroundColor Red
    exit 1
}
if (-not (Test-Command "pnpm")) {
    Write-Host "❌ pnpm is required. Install: npm install -g pnpm" -ForegroundColor Red
    exit 1
}
if (-not (Test-Command "docker")) {
    Write-Host "❌ Docker is required. Download: https://docker.com" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green

# Install dependencies
Write-Host "`n📦 Installing dependencies..."
pnpm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Start Docker services
Write-Host "`n🐳 Starting Docker services..."
docker compose -f tooling/docker/docker-compose.yml up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Wait for PostgreSQL
Write-Host "⏳ Waiting for PostgreSQL..."
Start-Sleep -Seconds 5

# Setup environment
if (-not (Test-Path "apps/api/.env")) {
    Copy-Item ".env.example" "apps/api/.env"
    Write-Host "📝 Created apps/api/.env from .env.example" -ForegroundColor Yellow
}

# Generate Prisma clients
Write-Host "`n🔧 Generating Prisma clients..."
Push-Location "apps/api"

npx prisma generate --schema=./prisma/platform.prisma
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

npx prisma generate --schema=./prisma/tenant.prisma
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

# Run migrations
Write-Host "`n🗃️ Running database migrations..."
npx prisma migrate dev --schema=./prisma/platform.prisma --name init
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

# Seed database
Write-Host "`n🌱 Seeding database..."
npx ts-node prisma/seed.ts
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

Pop-Location

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " ✅ Setup complete!                               " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

Write-Host "`nStart development servers:" -ForegroundColor White
Write-Host "  pnpm dev                              — Start all apps" -ForegroundColor Gray
Write-Host "  pnpm --filter @servix/api dev          — API only   (http://localhost:4000)" -ForegroundColor Gray
Write-Host "  pnpm --filter @servix/dashboard dev    — Dashboard  (http://localhost:3000)" -ForegroundColor Gray

Write-Host "`nUseful commands:" -ForegroundColor White
Write-Host "  pnpm docker:up     — Start Docker services" -ForegroundColor Gray
Write-Host "  pnpm docker:down   — Stop Docker services" -ForegroundColor Gray
Write-Host "  pnpm type-check    — Type check all apps" -ForegroundColor Gray
Write-Host "  pnpm test          — Run tests" -ForegroundColor Gray

Write-Host "`n📖 API docs:   http://localhost:4000/docs" -ForegroundColor Yellow
Write-Host "🎨 Dashboard:  http://localhost:3000" -ForegroundColor Yellow
Write-Host "📅 Booking:    http://localhost:3001" -ForegroundColor Yellow
Write-Host "⚙️ Admin:      http://localhost:3002" -ForegroundColor Yellow
Write-Host ""
