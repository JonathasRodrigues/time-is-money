import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@tim/api',
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
  async rewrites() {
    // Sem API_URL: Hono embutido em /api/v1 (produção Vercel).
    // Com API_URL: proxy para processo separado (dev local ou API standalone).
    const apiOrigin = process.env.API_URL?.trim();
    if (!apiOrigin) {
      return [];
    }
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
