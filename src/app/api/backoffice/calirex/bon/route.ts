import { NextRequest, NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { calirexGetBonLivraison } from "@/lib/calirex";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }

    const orderId = Number(req.nextUrl.searchParams.get("orderId"));
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    }

    const orderRes = await neonQuery<{ calirex_code_colis: string | null; calirex_bl_url: string | null }>(
      `SELECT calirex_code_colis, calirex_bl_url FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    const order = orderRes.rows[0];
    if (!order?.calirex_code_colis) {
      return NextResponse.json({ error: "Aucun colis Calirex pour cette commande." }, { status: 404 });
    }

    const bon = await calirexGetBonLivraison(order.calirex_code_colis);
    if (bon.download_link && bon.download_link !== order.calirex_bl_url) {
      await neonQuery(`UPDATE orders SET calirex_bl_url = $1, calirex_last_sync_at = NOW() WHERE id = $2`, [
        bon.download_link,
        orderId,
      ]);
    }

    return NextResponse.json({
      success: true,
      orderId,
      code_colis: order.calirex_code_colis,
      id_colis: bon.id_colis,
      download_link: bon.download_link || order.calirex_bl_url,
    });
  } catch (err) {
    console.error("[calirex/bon]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Calirex." },
      { status: 500 }
    );
  }
}
