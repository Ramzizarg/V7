import { NextRequest, NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { calirexCreateColis, calirexGetBonLivraison, isCalirexConfigured } from "@/lib/calirex";
import { normalizeTunisiaPhoneDigits } from "@/lib/phoneValidation";

export const runtime = "nodejs";
export const maxDuration = 60;

type OrderRow = {
  id: number;
  full_name: string;
  phone_number: string;
  phone_number_2: string | null;
  address: string;
  city: string;
  governorate: string;
  total_price: number;
  status: string;
  calirex_code_colis: string | null;
};

type ItemRow = {
  product_name: string;
  quantity: number;
  size: string | null;
};

export async function POST(req: NextRequest) {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }

    if (!(await isCalirexConfigured())) {
      return NextResponse.json(
        {
          error:
            "Calirex non configuré sur le serveur. Ajoutez CALIREX_LOGIN / CALIREX_PASSWORD sur Vercel (ou app_settings).",
        },
        { status: 503 }
      );
    }

    const body = (await req.json()) as { orderId?: number | string };
    const orderId = Number(body.orderId);
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    }

    const orderRes = await neonQuery<OrderRow>(
      `SELECT id, full_name, phone_number, phone_number_2, address, city, governorate, total_price, status, calirex_code_colis
       FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    const order = orderRes.rows[0];
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    if (order.calirex_code_colis) {
      return NextResponse.json({
        success: true,
        alreadyShipped: true,
        orderId,
        code_colis: order.calirex_code_colis,
        status: order.status,
      });
    }

    const itemsRes = await neonQuery<ItemRow>(
      `SELECT product_name, quantity, size FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const items = itemsRes.rows ?? [];
    const nbPieces = Math.max(
      1,
      items.reduce((sum, i) => sum + Math.max(0, Math.floor(Number(i.quantity) || 0)), 0)
    );
    const designation =
      items
        .map((i) => {
          const size = i.size?.trim() ? ` (${i.size.trim()})` : "";
          return `${i.product_name}${size} ×${i.quantity}`;
        })
        .join(", ")
        .slice(0, 240) || `Commande Vero7 #${orderId}`;

    const phone = normalizeTunisiaPhoneDigits(order.phone_number);
    if (phone.length !== 8) {
      return NextResponse.json(
        { error: "Téléphone client invalide pour Calirex (8 chiffres)." },
        { status: 400 }
      );
    }
    const phone2Raw = normalizeTunisiaPhoneDigits(order.phone_number_2 ?? "");
    const phone2 = phone2Raw.length === 8 ? phone2Raw : undefined;

    const address = [order.address, order.city].filter(Boolean).join(", ").trim();
    if (!address || !order.governorate?.trim() || !order.full_name?.trim()) {
      return NextResponse.json({ error: "Adresse / client incomplets." }, { status: 400 });
    }

    const codeColis = await calirexCreateColis({
      nom_client: order.full_name.trim(),
      tel_client: phone,
      tel2_client: phone2,
      adresse_client: address,
      gouvernorat_client: order.governorate.trim(),
      delegation_client: order.city?.trim() || undefined,
      localite_client: order.city?.trim() || undefined,
      prix: Math.round(Number(order.total_price) || 0),
      nb_pieces: nbPieces,
      designation,
      codeClient: `VERO7-${orderId}`,
      poids: 1,
      echange: "non",
      fragile: "non",
      ouvcolis: 0,
    });

    let blUrl: string | null = null;
    try {
      const bon = await calirexGetBonLivraison(codeColis);
      blUrl = bon.download_link;
    } catch {
      // BL may be available a bit later
    }

    await neonQuery(
      `UPDATE orders SET
         calirex_code_colis = $1,
         calirex_etat = COALESCE(calirex_etat, 'en attente'),
         calirex_bl_url = COALESCE($2, calirex_bl_url),
         calirex_shipped_at = NOW(),
         calirex_last_sync_at = NOW(),
         status = 'out_for_delivery'
       WHERE id = $3`,
      [codeColis, blUrl, orderId]
    );

    return NextResponse.json({
      success: true,
      orderId,
      code_colis: codeColis,
      bl_url: blUrl,
      status: "out_for_delivery",
    });
  } catch (err) {
    console.error("[calirex/ship]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Calirex." },
      { status: 500 }
    );
  }
}
