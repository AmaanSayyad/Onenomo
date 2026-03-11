import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // @ts-ignore
  outputFileTracingRoot: process.cwd(),
  // @ts-ignore
  turbopack: {
    // Define the project root to avoid inference issues with parent folders (e.g., C:/Users/enliven/bun.lock)
    root: process.cwd(),
  },
};

export default nextConfig;
