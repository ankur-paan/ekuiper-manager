/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Silence Next.js 16 Turbopack warning when webpack config is present
  turbopack: {},
  webpack: (config) => {
    // Monaco Editor webpack configuration
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

module.exports = nextConfig;
