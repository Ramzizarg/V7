/**
 * Unique id per deployment. Changes when Vercel/Git SHA changes or on local dev boot.
 * Used to invalidate client-side content caches without clearing cart/wishlist.
 */
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  "development";

const BUILD_MARKER_KEY = "vero7:app-build-id";

/** localStorage keys that cache CMS/content and can hide post-deploy UI updates. */
const DEPLOY_INVALIDATED_LOCAL_KEYS = [
  "blacktephra-home-content",
  "blacktephra-coming-soon-settings",
] as const;

const DEPLOY_INVALIDATED_SESSION_KEYS = ["vero7:storefront-catalog"] as const;

/**
 * After a new deployment, drop stale CMS caches so the client refetches from the API/DB.
 * Cart and wishlist are intentionally preserved.
 */
export function syncClientCachesWithDeployment(): void {
  if (typeof window === "undefined") return;
  const previous = localStorage.getItem(BUILD_MARKER_KEY);
  if (previous === APP_BUILD_ID) return;

  for (const key of DEPLOY_INVALIDATED_LOCAL_KEYS) {
    localStorage.removeItem(key);
  }
  for (const key of DEPLOY_INVALIDATED_SESSION_KEYS) {
    sessionStorage.removeItem(key);
  }
  localStorage.setItem(BUILD_MARKER_KEY, APP_BUILD_ID);
}
