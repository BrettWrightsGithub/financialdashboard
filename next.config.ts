import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for optimized Docker builds
  output: 'standalone',
  
  // Optimize images for production
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
};

export default nextConfig;
