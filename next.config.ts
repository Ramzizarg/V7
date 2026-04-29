import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/V7/V7-2.png" }];
  },
};

export default nextConfig;
