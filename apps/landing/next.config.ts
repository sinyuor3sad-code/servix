import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // A8-014: stop emitting `X-Powered-By: Next.js`.
  poweredByHeader: false,
};

export default nextConfig;
