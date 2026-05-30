import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  BACKOFFICE_SESSION_COOKIE,
  verifyBackofficeSessionToken,
} from "@/lib/backofficeAuth";
import {
  applyApiCacheHeaders,
  applyDocumentCacheHeaders,
  isApiPath,
  isDocumentNavigation,
  isNextInternalAssetPath,
} from "@/lib/cacheHeaders";

const PROTECTED_PREFIXES = ["/dashboard", "/backoffice"];
const PUBLIC_BACKOFFICE_PATHS = ["/login", "/api/backoffice/login"];

async function handleBackofficeAuth(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return null;

  const isPublicBackofficePath = PUBLIC_BACKOFFICE_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  const token = request.cookies.get(BACKOFFICE_SESSION_COOKIE)?.value;
  const isAuthenticated = await verifyBackofficeSessionToken(token);

  if (isPublicBackofficePath) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return null;
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return null;
}

function applyRouteCacheHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const { pathname } = request.nextUrl;

  if (isNextInternalAssetPath(pathname)) {
    return response;
  }

  if (isApiPath(pathname)) {
    applyApiCacheHeaders(response);
    return response;
  }

  if (isDocumentNavigation(pathname)) {
    applyDocumentCacheHeaders(response);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const authResponse = await handleBackofficeAuth(request);
  if (authResponse) {
    return applyRouteCacheHeaders(request, authResponse);
  }

  const response = NextResponse.next();
  return applyRouteCacheHeaders(request, response);
}

export const config = {
  matcher: [
    /*
     * Run on all routes except Next hashed static assets and optimized images.
     * HTML gets no-store; API gets no-store; public files keep next.config headers.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
