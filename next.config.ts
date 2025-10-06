import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "openweathermap.org",
        pathname: "/img/wn/**",
      },
    ],
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    const shimPath = path.resolve(__dirname, 'polyfills/use-sync-external-store/shim/index.js');
    config.resolve.alias['use-sync-external-store/shim/index.js'] = shimPath;
    config.resolve.alias['use-sync-external-store/shim'] = shimPath;
    config.resolve.alias['use-sync-external-store'] = shimPath;
    return config;
  },
};

export default nextConfig;
