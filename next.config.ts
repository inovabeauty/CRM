import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.17', '192.168.1.*', 'localhost:3000'],
};

export default nextConfig;
