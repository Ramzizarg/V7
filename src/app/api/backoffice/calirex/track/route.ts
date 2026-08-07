import { NextRequest, NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  calirexGetPosDetail,
  mapCalirexEtatToOrderStatus,
  pickCalirexEtat,
} from "@/lib/calirex";

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

    const orderRes = await neonQuery<{
      calirex_code_colis: string | null;
      status: string;
    }>(`SELECT calirex_code_colis, status FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
    const order = orderRes.rows[0];
    if (!order?.calirex_code_colis) {
      return NextResponse.json({ error: "Aucun colis Calirex pour cette commande." }, { status: 404 });
    }

    const detail = await calirexGetPosDetail(order.calirex_code_colis);
    const etat = pickCalirexEtat(detail);
    const mapped = mapCalirexEtatToOrderStatus(etat);
    const nextStatus = mapped ?? order.status;

    if (etat) {
      await neonQuery(
        `UPDATE orders SET calirex_etat = $1, status = $2, calirex_last_sync_at = NOW() WHERE id = $3`,
        [etat, nextStatus, orderId]
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      code_colis: order.calirex_code_colis,
      etat,
      status: nextStatus,
      colis: detail.colis ?? null,
      etat_colis: detail.etat_colis ?? [],
    });
  } catch (err) {
    console.error("[calirex/track]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Calirex." },
      { status: 500 }
    );
  }
}
