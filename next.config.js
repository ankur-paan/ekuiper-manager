/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Force Webpack by including a custom config (Next.js disables Turbopack if webpack config is present)
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
