import { NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { calirexGetPosDetailsList, mapCalirexEtatToOrderStatus } from "@/lib/calirex";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }

    const { rows } = await neonQuery<{
      id: number;
      status: string;
      calirex_code_colis: string;
    }>(
      `SELECT id, status, calirex_code_colis
       FROM orders
       WHERE calirex_code_colis IS NOT NULL AND calirex_code_colis <> ''
         AND status NOT IN ('delivered', 'rejected')
       ORDER BY calirex_shipped_at DESC NULLS LAST
       LIMIT 80`
    );

    if (!rows.length) {
      return NextResponse.json({ success: true, updated: 0, results: [] });
    }

    const codes = rows.map((r) => r.calirex_code_colis);
    const batch = await calirexGetPosDetailsList(codes);
    const byCode = new Map(rows.map((r) => [r.calirex_code_colis, r]));
    let updated = 0;
    const results: { orderId: number; code_colis: string; etat: string | null; status: string }[] = [];

    for (const [code, detail] of Object.entries(batch)) {
      const order = byCode.get(code);
      if (!order) continue;
      const etat =
        (typeof detail.colis?.etat === "string" && detail.colis.etat) ||
        detail.etat_colis?.[0]?.etat ||
        null;
      const mapped = mapCalirexEtatToOrderStatus(etat);
      const nextStatus = mapped && order.status !== "rejected" ? mapped : order.status;

      await neonQuery(
        `UPDATE orders SET
           calirex_etat = COALESCE($1, calirex_etat),
           status = $2,
           calirex_last_sync_at = NOW()
         WHERE id = $3`,
        [etat, nextStatus, order.id]
      );
      updated += 1;
      results.push({ orderId: order.id, code_colis: code, etat, status: nextStatus });
    }

    return NextResponse.json({ success: true, updated, results });
  } catch (err) {
    console.error("[calirex/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Calirex." },
      { status: 500 }
    );
  }
}
