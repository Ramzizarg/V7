import { NextRequest, NextResponse } from "next/server";
import {
  countOnlineVisitors,
  ensurePresenceTable,
  isStorefrontPath,
  listRecentPresence,
  PRESENCE_ONLINE_WINDOW_MS,
  pruneStalePresence,
  upsertPresence,
} from "@/lib/sitePresence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|facebookexternalhit|bytespider|gptbot|claudebot|headlesschrome/i.test(
    ua
  );
}

function noStoreJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

/** POST — visitor heartbeat. GET — online count for dashboard. */
export async function POST(req: NextRequest) {
  try {
    const ok = await ensurePresenceTable();
    if (!ok) return noStoreJson({ ok: false, online: 0 }, 503);

    const ua = req.headers.get("user-agent") ?? "";
    if (isBot(ua)) return noStoreJson({ ok: true, skipped: true, online: await countOnlineVisitors() });

    let visitorId = "";
    let path: string | null = null;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as {
        visitorId?: string;
        path?: string;
      } | null;
      visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
      path = typeof body?.path === "string" ? body.path : null;
    } else {
      // sendBeacon often posts text/plain
      const text = await req.text().catch(() => "");
      try {
        const body = JSON.parse(text) as { visitorId?: string; path?: string };
        visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
        path = typeof body?.path === "string" ? body.path : null;
      } catch {
        return noStoreJson({ error: "invalid body" }, 400);
      }
    }

    if (!visitorId || visitorId.length < 8) {
      return noStoreJson({ error: "visitorId required" }, 400);
    }

    if (!isStorefrontPath(path)) {
      return noStoreJson({ ok: true, skipped: true, online: await countOnlineVisitors() });
    }

    await upsertPresence({ visitorId, path, userAgent: ua });

    if (Math.random() < 0.08) void pruneStalePresence();

    const online = await countOnlineVisitors();
    return noStoreJson({ ok: true, online });
  } catch (err) {
    console.error("[presence] POST error:", err);
    return noStoreJson({ error: "presence failed", online: 0 }, 500);
  }
}

export async function GET() {
  try {
    const ok = await ensurePresenceTable();
    if (!ok) return noStoreJson({ online: 0 }, 503);

    const [online, recent] = await Promise.all([
      countOnlineVisitors(),
      listRecentPresence(6),
    ]);

    return noStoreJson({
      online,
      windowSeconds: Math.floor(PRESENCE_ONLINE_WINDOW_MS / 1000),
      recent: recent.map((r) => ({
        path: r.path || "/",
        lastSeen: r.last_seen,
      })),
    });
  } catch (err) {
    console.error("[presence] GET error:", err);
    return noStoreJson({ online: 0 }, 500);
  }
}
