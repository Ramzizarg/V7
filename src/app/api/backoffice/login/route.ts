import { NextResponse } from "next/server";
import {
  BACKOFFICE_SESSION_COOKIE,
  createBackofficeSessionToken,
  getBackofficeCredentials,
  verifyBackofficePassword,
} from "@/lib/backofficeAuth";

type AttemptInfo = {
  count: number;
  firstAt: number;
  blockedUntil: number;
};

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000; // 15 min
const attemptsByIp = new Map<string, AttemptInfo>();

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function cleanAttempts(now: number) {
  for (const [ip, info] of attemptsByIp.entries()) {
    if (info.blockedUntil < now && info.firstAt + ATTEMPT_WINDOW_MS < now) {
      attemptsByIp.delete(ip);
    }
  }
}

export async function POST(request: Request) {
  const now = Date.now();
  cleanAttempts(now);
  const ip = clientIp(request);
  const attempt = attemptsByIp.get(ip);
  if (attempt && attempt.blockedUntil > now) {
    const retrySeconds = Math.ceil((attempt.blockedUntil - now) / 1000);
    return NextResponse.redirect(
      new URL(`/login?error=1&retry=${retrySeconds}`, request.url),
      { status: 303 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  let email = "";
  let password = "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    email = body?.email?.trim() ?? "";
    password = body?.password ?? "";
  } else {
    const form = await request.formData();
    email = String(form.get("email") ?? "").trim();
    password = String(form.get("password") ?? "");
  }

  const expected = getBackofficeCredentials();

  const emailOk = email.toLowerCase() === expected.email.toLowerCase();
  const passwordOk = await verifyBackofficePassword(password);

  if (!emailOk || !passwordOk) {
    const prev = attemptsByIp.get(ip);
    if (!prev || prev.firstAt + ATTEMPT_WINDOW_MS < now) {
      attemptsByIp.set(ip, {
        count: 1,
        firstAt: now,
        blockedUntil: 0,
      });
    } else {
      const nextCount = prev.count + 1;
      attemptsByIp.set(ip, {
        count: nextCount,
        firstAt: prev.firstAt,
        blockedUntil: nextCount >= MAX_ATTEMPTS ? now + BLOCK_MS : 0,
      });
    }

    return NextResponse.redirect(
      new URL("/login?error=1", request.url),
      { status: 303 }
    );
  }

  attemptsByIp.delete(ip);

  const token = await createBackofficeSessionToken();
  const response = NextResponse.redirect(new URL("/dashboard", request.url), {
    status: 303,
  });

  response.cookies.set(BACKOFFICE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
