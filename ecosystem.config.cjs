// ═══════════════════════════════════════════════════════════
// SERVIX — PM2 Ecosystem Configuration (Production)
// Run: pm2 start ecosystem.config.cjs --env production
// ═══════════════════════════════════════════════════════════

module.exports = {
  apps: [
    // ═══════════ API (NestJS) — Port 4000 ═══════════
    {
      name: 'servix-api',
      cwd: './apps/api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      watch: false,
    },

    // ═══════════ Dashboard (Next.js standalone) — Port 3001 ═══════════
    {
      name: 'servix-dashboard',
      cwd: './apps/dashboard',
      script: '.next/standalone/apps/dashboard/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/dashboard-error.log',
      out_file: './logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    },

    // ═══════════ Admin (Next.js standalone) — Port 3002 ═══════════
    {
      name: 'servix-admin',
      cwd: './apps/admin',
      script: '.next/standalone/apps/admin/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    },

    // ═══════════ Booking (Next.js standalone) — Port 3003 ═══════════
    {
      name: 'servix-booking',
      cwd: './apps/booking',
      script: '.next/standalone/apps/booking/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3003,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/booking-error.log',
      out_file: './logs/booking-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    },

    // ═══════════ Landing (Next.js standalone) — Port 3004 ═══════════
    {
      name: 'servix-landing',
      cwd: './apps/landing',
      script: '.next/standalone/apps/landing/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3004,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/landing-error.log',
      out_file: './logs/landing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    },
  ],
};
