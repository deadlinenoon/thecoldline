/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  modularizeImports: {
    // small perf win: split recharts imports if you use charts anywhere
    recharts: { transform: 'recharts/es6/{{member}}' },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.balldontlie.io',
      },
      {
        protocol: 'https',
        hostname: 'cdn.balldontlie.io',
      },
    ],
  },
};
module.exports = nextConfig;
