import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  BACKOFFICE_SESSION_COOKIE,
  verifyBackofficeSessionToken,
} from "@/lib/backofficeAuth";

const PROTECTED_PREFIXES = ["/dashboard", "/backoffice"];
const PUBLIC_BACKOFFICE_PATHS = ["/login", "/api/backoffice/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (!isProtected) return NextResponse.next();

  const isPublicBackofficePath = PUBLIC_BACKOFFICE_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  const token = request.cookies.get(BACKOFFICE_SESSION_COOKIE)?.value;
  const isAuthenticated = await verifyBackofficeSessionToken(token);

  if (isPublicBackofficePath) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/backoffice/:path*", "/login", "/api/backoffice/:path*"],
};
