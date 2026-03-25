import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@servix/ui', '@servix/utils', '@servix/types'],
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: false },
      { source: '/dashboard/:path*', destination: '/:path*', permanent: false },
    ];
  },
};

export default nextConfig;
