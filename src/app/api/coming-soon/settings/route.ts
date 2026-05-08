import { NextResponse } from "next/server";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { createHash } from "crypto";

export const runtime = "nodejs";

type PublicSettings = { enabled: boolean; heroImageUrl: string; endAt: string; requirePassword: boolean; hasPassword?: boolean };

function toPublic(row: any): PublicSettings {
  return {
    enabled: Boolean(row?.enabled),
    heroImageUrl: String(row?.hero_image_url ?? ""),
    endAt: String(row?.end_at ?? ""),
    requirePassword: Boolean(row?.require_password),
    hasPassword: Boolean(row?.password_hash),
  };
}

function getPepper() {
  return process.env.COMING_SOON_PASSWORD_PEPPER || process.env.COMING_SOON_COOKIE_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dev-pepper";
}

function hashPassword(password: string) {
  return createHash("sha256").update(`${getPepper()}:${password}`, "utf8").digest("hex");
}

function isMissingComingSoonTable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const anyErr = error as Error & { code?: string };
  const msg = `${anyErr.message || ""}`.toLowerCase();
  return anyErr.code === "42P01" || (msg.includes("coming_soon_settings") && msg.includes("does not exist"));
}

async function ensureComingSoonSettingsTable() {
  await neonQuery(`
    CREATE TABLE IF NOT EXISTS coming_soon_settings (
      id text PRIMARY KEY,
      enabled boolean NOT NULL DEFAULT false,
      hero_image_url text NOT NULL DEFAULT '',
      end_at timestamptz NULL,
      require_password boolean NOT NULL DEFAULT false,
      password_hash text NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function GET() {
  if (!resolveDatabaseUrl()) {
    return NextResponse.json({ enabled: false, heroImageUrl: "", endAt: "", requirePassword: false, hasPassword: false });
  }
  try {
    const { rows } = await neonQuery(
      "SELECT enabled, hero_image_url, end_at, require_password, password_hash FROM coming_soon_settings WHERE id = $1 LIMIT 1",
      ["default"]
    );
    if (!rows[0]) {
      return NextResponse.json({ enabled: false, heroImageUrl: "", endAt: "", requirePassword: false, hasPassword: false });
    }
    return NextResponse.json(toPublic(rows[0]));
  } catch (error) {
    if (isMissingComingSoonTable(error)) {
      await ensureComingSoonSettingsTable();
      return NextResponse.json({ enabled: false, heroImageUrl: "", endAt: "", requirePassword: false, hasPassword: false });
    }
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as (PublicSettings & { newPassword?: string }) | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const enabled = Boolean(body.enabled);
  const hero_image_url = typeof body.heroImageUrl === "string" ? body.heroImageUrl : "";
  const require_password = Boolean(body.requirePassword);
  const end_at = body.endAt ? new Date(body.endAt).toISOString() : null;
  const password_hash = !require_password
    ? null
    : typeof body.newPassword === "string" && body.newPassword.trim().length > 0
      ? hashPassword(body.newPassword.trim())
      : undefined;

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ ok: true });
    }
    if (password_hash === undefined) {
      await neonQuery(
        "INSERT INTO coming_soon_settings (id, enabled, hero_image_url, require_password, end_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET enabled=EXCLUDED.enabled, hero_image_url=EXCLUDED.hero_image_url, require_password=EXCLUDED.require_password, end_at=EXCLUDED.end_at, updated_at=EXCLUDED.updated_at",
        ["default", enabled, hero_image_url, require_password, end_at, new Date().toISOString()]
      );
    } else {
      await neonQuery(
        "INSERT INTO coming_soon_settings (id, enabled, hero_image_url, require_password, end_at, password_hash, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET enabled=EXCLUDED.enabled, hero_image_url=EXCLUDED.hero_image_url, require_password=EXCLUDED.require_password, end_at=EXCLUDED.end_at, password_hash=EXCLUDED.password_hash, updated_at=EXCLUDED.updated_at",
        ["default", enabled, hero_image_url, require_password, end_at, password_hash, new Date().toISOString()]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingComingSoonTable(error)) {
      await ensureComingSoonSettingsTable();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
