import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@tim/ui',
    '@tim/domain',
    '@tim/validators',
    '@tim/permissions',
    '@tim/auth',
    '@tim/db',
    '@tim/application',
    '@tim/jarvis',
    '@tim/mocks',
    '@tim/imex',
    '@tim/email',
    '@tim/crypto',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
