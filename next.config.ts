import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/V7/V7-2.png" }];
  },
};

export default nextConfig;
