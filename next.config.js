const remotePatterns = [
  {
    protocol: 'https',
    hostname: 'assets.balldontlie.io',
  },
  {
    protocol: 'https',
    hostname: 'cdn.balldontlie.io',
  },
  {
    protocol: 'https',
    hostname: 'openweathermap.org',
    pathname: '/img/wn/**',
  },
  {
    protocol: 'https',
    hostname: 'static.www.nfl.com',
    pathname: '/**',
  },
];

const logoCdn = process.env.NEXT_PUBLIC_LOGO_CDN;
if (logoCdn) {
  try {
    const url = new URL(logoCdn);
    remotePatterns.push({
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      pathname: '/**',
    });
  } catch (error) {
    console.warn('[next.config] Invalid NEXT_PUBLIC_LOGO_CDN', error);
  }
}

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  modularizeImports: {
    // small perf win: split recharts imports if you use charts anywhere
    recharts: { transform: 'recharts/es6/{{member}}' },
  },
  images: {
    remotePatterns,
  },
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['use-sync-external-store/shim/index.js'] = path.resolve(
      __dirname,
      'src/shims/useSyncExternalStoreShim.ts'
    );
    return config;
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/coldline',
        permanent: true,
      },
    ];
  },
};
module.exports = nextConfig;
