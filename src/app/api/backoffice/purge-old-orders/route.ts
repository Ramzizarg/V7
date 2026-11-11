import { NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { resolveDatabaseUrl } from "@/lib/neon-db";
import { purgeOldOrders } from "@/lib/purgeOldOrders";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Deletes past-month orders (keeps only the current Tunis calendar month). */
export async function POST() {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }
    const result = await purgeOldOrders();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[purge-old-orders]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Purge impossible." },
      { status: 500 }
    );
  }
}
