import { NextResponse } from "next/server";
import { neonQuery } from "@/lib/neon-db";
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

function getPepper() {
  return process.env.COMING_SOON_PASSWORD_PEPPER || process.env.COMING_SOON_COOKIE_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dev-pepper";
}
function hashPassword(password: string) {
  return createHash("sha256").update(`${getPepper()}:${password}`, "utf8").digest("hex");
}
function getCookieSecret() {
  return process.env.COMING_SOON_COOKIE_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dev-cookie-secret";
}
function signToken(payloadB64: string) {
  return createHmac("sha256", getCookieSecret()).update(payloadB64, "utf8").digest("base64url");
}

function buildAccessCookieResponse(next: string, endAtIso: string | null): NextResponse {
  const exp = endAtIso && !Number.isNaN(Date.parse(endAtIso)) ? Math.floor(Date.parse(endAtIso) / 1000) : Math.floor(Date.now() / 1000) + 86400;
  const payloadB64 = Buffer.from(JSON.stringify({ v: 1, exp }), "utf8").toString("base64url");
  const token = `${payloadB64}.${signToken(payloadB64)}`;
  const res = NextResponse.json({ ok: true, next });
  res.cookies.set({ name: "bt_cs", value: token, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(exp * 1000) });
  return res;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: string; next?: string } | null;
  const password = body?.password ?? "";
  const next = typeof body?.next === "string" ? body.next : "/";

  try {
    const { rows } = await neonQuery("SELECT enabled, require_password, password_hash, end_at FROM coming_soon_settings WHERE id = $1 LIMIT 1", ["default"]);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
    if (!row.enabled) return NextResponse.json({ ok: true, next });
    if (!row.require_password) return buildAccessCookieResponse(next, row.end_at ?? null);

    const expectedHash = row.password_hash as string | null;
    if (!expectedHash) return NextResponse.json({ error: "Password not configured" }, { status: 400 });

    const candidate = hashPassword(String(password));
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(expectedHash, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return buildAccessCookieResponse(next, row.end_at ?? null);
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
