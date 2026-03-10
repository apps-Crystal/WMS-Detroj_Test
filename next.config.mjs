/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip ESLint errors during Vercel build (lint separately in CI if needed)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip TypeScript errors during Vercel build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
