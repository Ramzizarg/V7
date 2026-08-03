import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";

/** Active if heartbeat within this window (Shopify-like “right now”). */
export const PRESENCE_ONLINE_WINDOW_MS = 5 * 60 * 1000;

let presenceTableReady = false;

export async function ensurePresenceTable(): Promise<boolean> {
  if (!resolveDatabaseUrl()) return false;
  if (presenceTableReady) return true;
  try {
    await neonQuery(`
      CREATE TABLE IF NOT EXISTS site_presence (
        visitor_id text PRIMARY KEY,
        last_seen timestamptz NOT NULL DEFAULT now(),
        path text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await neonQuery(`
      CREATE INDEX IF NOT EXISTS site_presence_last_seen_idx
      ON site_presence (last_seen DESC)
    `);
    presenceTableReady = true;
    return true;
  } catch (err) {
    console.error("[presence] ensure table failed:", err);
    return false;
  }
}

export function isStorefrontPath(path: string | null | undefined): boolean {
  if (!path) return true;
  const p = path.startsWith("/") ? path : `/${path}`;
  return !/^\/(dashboard|api|backoffice|login)(\/|$)/i.test(p);
}

export async function upsertPresence(input: {
  visitorId: string;
  path?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const id = input.visitorId.trim().slice(0, 120);
  if (!id || id.length < 8) return;
  await neonQuery(
    `INSERT INTO site_presence (visitor_id, last_seen, path, user_agent, created_at)
     VALUES ($1, now(), $2, $3, now())
     ON CONFLICT (visitor_id) DO UPDATE
     SET last_seen = now(),
         path = COALESCE(EXCLUDED.path, site_presence.path),
         user_agent = COALESCE(EXCLUDED.user_agent, site_presence.user_agent)`,
    [id, input.path?.slice(0, 300) ?? null, input.userAgent?.slice(0, 300) ?? null]
  );
}

export async function countOnlineVisitors(windowMs = PRESENCE_ONLINE_WINDOW_MS): Promise<number> {
  const seconds = Math.max(60, Math.floor(windowMs / 1000));
  const { rows } = await neonQuery<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count
     FROM site_presence
     WHERE last_seen > now() - ($1::int * interval '1 second')`,
    [seconds]
  );
  const raw = rows?.[0]?.count;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function listRecentPresence(limit = 8, windowMs = PRESENCE_ONLINE_WINDOW_MS) {
  const seconds = Math.max(60, Math.floor(windowMs / 1000));
  const { rows } = await neonQuery<{ path: string | null; last_seen: string }>(
    `SELECT path, last_seen
     FROM site_presence
     WHERE last_seen > now() - ($1::int * interval '1 second')
     ORDER BY last_seen DESC
     LIMIT $2`,
    [seconds, limit]
  );
  return rows ?? [];
}

export async function pruneStalePresence(): Promise<void> {
  try {
    await neonQuery(`DELETE FROM site_presence WHERE last_seen < now() - interval '48 hours'`);
  } catch {
    // ignore
  }
}
