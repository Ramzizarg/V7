"use client";

import { useEffect } from "react";
import { syncClientCachesWithDeployment } from "@/lib/appBuildId";

/**
 * Runs once per page load: clears stale CMS localStorage when APP_BUILD_ID changes
 * (new Vercel deployment). Prevents showing old homepage/coming-soon after deploy.
 */
export function AppBuildCacheGuard() {
  useEffect(() => {
    syncClientCachesWithDeployment();
  }, []);
  return null;
}
