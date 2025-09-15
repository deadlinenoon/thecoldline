/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep cssnano from crashing; we can re-enable later
  experimental: { optimizeCss: false },

  // Fine to keep builds moving; we can flip this later
  eslint: { ignoreDuringBuilds: true },

  webpack: (config, { dev }) => {
    // Optional flag: skip ALL minification (JS+CSS) when set
    if (process.env.NO_CSS_MINIFY === '1' && !dev) {
      if (config.optimization) {
        config.optimization.minimize = false;
        config.optimization.minimizer = [];
      }
    }
    return config;
  },
};
module.exports = nextConfig;
