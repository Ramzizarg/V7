/**
 * Central cache policy (Shopify-style):
 * - HTML / app shell: never cached (always revalidate with server)
 * - API: never cached
 * - /_next/static/*: immutable (content-hashed by Next.js per deployment)
 * - /uploads/*: long cache (filenames are unique per upload)
 * - Other /public media: short cache + revalidate (same path can change)
 */

export const ONE_YEAR = 31536000;

/** HTML documents and navigations — must not be stored by browsers or edge CDN. */
export const DOCUMENT_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  /** Vercel Edge: do not serve a cached HTML shell from a previous deployment. */
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

/** JSON API responses — always fresh. */
export const API_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

/** Next.js build output (`/_next/static/chunks/…-abc123.js`). Safe: hash changes every deploy. */
export const NEXT_STATIC_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": `public, max-age=${ONE_YEAR}, immutable`,
};

/** User uploads with timestamp in the filename. */
export const UPLOAD_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": `public, max-age=${ONE_YEAR}, immutable`,
};

/** Public folder assets that may be replaced in place (e.g. /V7/logo.jpg). */
export const PUBLIC_MEDIA_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "public, max-age=3600, must-revalidate",
};

function applyHeaders(target: Headers, headers: Readonly<Record<string, string>>) {
  for (const [key, value] of Object.entries(headers)) {
    target.set(key, value);
  }
}

export function applyDocumentCacheHeaders(response: { headers: Headers }) {
  applyHeaders(response.headers, DOCUMENT_CACHE_HEADERS);
}

export function applyApiCacheHeaders(response: { headers: Headers }) {
  applyHeaders(response.headers, API_CACHE_HEADERS);
}

/** Paths that should never receive HTML no-store overrides (Next serves its own headers). */
export function isNextInternalAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico"
  );
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/** Static file extension in URL (public/ or uploads/). */
export function isPublicFilePath(pathname: string): boolean {
  return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|otf|eot|mp4|webm|pdf)$/i.test(
    pathname
  );
}

export function isDocumentNavigation(pathname: string): boolean {
  if (isNextInternalAssetPath(pathname)) return false;
  if (isApiPath(pathname)) return false;
  if (isPublicFilePath(pathname)) return false;
  return true;
}
