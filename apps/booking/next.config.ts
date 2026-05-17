import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // A8-014: stop emitting `X-Powered-By: Next.js`.
  poweredByHeader: false,

  // Compression for smaller bundle
  compress: true,
  
  // Optimize package imports
  experimental: {
    optimizePackageImports: ['lucide-react', 'sonner'],
  },

  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.servi-x.com' },
    ],
    // Optimize images
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // PWA headers
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
        // Cache Next.js static assets aggressively
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // A8-014: security headers moved to nginx global (was duplicating + conflicting).
    ];
  },
};

export default nextConfig;
