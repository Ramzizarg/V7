import type { NextConfig } from "next";
import { ONE_YEAR, PUBLIC_MEDIA_CACHE_HEADERS, UPLOAD_CACHE_HEADERS } from "./src/lib/cacheHeaders";

/** Stable per deployment — ties JS chunk hashes and client cache invalidation together. */
const deploymentBuildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
  `local-${Date.now()}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: deploymentBuildId,
  },
  generateBuildId: async () => deploymentBuildId,
  images: {
    formats: ["image/avif", "image/webp"],
    /** Must include every `quality` used by next/image components. */
    qualities: [75, 80, 85, 90],
    /**
     * Include 1536/2560 so mobile retina (390×3 ≈ 1170) and cropped heroes
     * can pick a sharp candidate instead of upscaling a soft 828–1080 encode.
     */
    deviceSizes: [640, 750, 828, 1080, 1200, 1536, 1920, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 200, 240, 280, 384],
    minimumCacheTTL: ONE_YEAR,
    remotePatterns: [
      /** Public Blob stores: `{storeId}.public.blob.vercel-storage.com` */
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      /** Legacy / alternate Blob hostnames */
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: Object.entries(UPLOAD_CACHE_HEADERS).map(([key, value]) => ({ key, value })),
      },
      {
        source: "/V7/:path*",
        headers: Object.entries(PUBLIC_MEDIA_CACHE_HEADERS).map(([key, value]) => ({
          key,
          value,
        })),
      },
      {
        source: "/:path(.*\\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?))",
        headers: Object.entries(PUBLIC_MEDIA_CACHE_HEADERS).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon-32.png" }];
  },
};

export default nextConfig;
