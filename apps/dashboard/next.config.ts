import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // A8-014: stop emitting `X-Powered-By: Next.js` — nothing reads it, attackers fingerprint with it.
  poweredByHeader: false,
  transpilePackages: ['@servix/ui', '@servix/utils', '@servix/types'],

  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: false },
      { source: '/dashboard/:path*', destination: '/:path*', permanent: false },
    ];
  },

  // PWA + performance headers
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // A8-014: X-Content-Type-Options / X-Frame-Options / X-XSS-Protection / Referrer-Policy
      // removed here — already set globally at nginx (single source of truth).
      // The duplicate caused browsers to see X-Frame-Options twice with conflicting values
      // (DENY from Next.js vs SAMEORIGIN from nginx).
    ];
  },
};

export default nextConfig;
