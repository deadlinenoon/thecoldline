/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  modularizeImports: {
    // small perf win: split recharts imports if you use charts anywhere
    recharts: { transform: 'recharts/es6/{{member}}' },
  },
};
module.exports = nextConfig;
