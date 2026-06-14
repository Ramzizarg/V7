import { NextRequest, NextResponse } from "next/server";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { sendOrderEmails, type OrderEmailPayload } from "@/lib/sendOrderEmails";

export const runtime = "nodejs";
export const maxDuration = 60;

type PlaceOrderItem = {
  productId: number;
  product_name: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  image_url?: string | null;
};

type PlaceOrderBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  governorate?: string;
  couponCode?: string | null;
  discountAmount?: number;
  total?: number;
  subtotal?: number;
  shipping?: number;
  items?: PlaceOrderItem[];
};

export async function POST(req: NextRequest) {
  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }

    const body = (await req.json()) as PlaceOrderBody;
    const fullName = body.fullName?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    const address = body.address?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const governorate = body.governorate?.trim() ?? "";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!fullName || !email || !phone || !address || !city || !governorate) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Panier vide." }, { status: 400 });
    }

    const total = Number(body.total ?? 0);
    const subtotal = Number(body.subtotal ?? 0);
    const shipping = Number(body.shipping ?? 0);
    const discountAmount = Number(body.discountAmount ?? 0);

    const orderRes = await neonQuery<{ id: number }>(
      `INSERT INTO orders (
        full_name, email, phone_number, address, city, governorate,
        coupon_code, discount_amount, total_price, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        fullName,
        email,
        phone,
        address,
        city,
        governorate,
        body.couponCode?.trim() || null,
        discountAmount > 0 ? discountAmount : 0,
        total,
        "pending",
      ]
    );

    const orderId = orderRes.rows[0]?.id;
    if (!orderId) {
      return NextResponse.json({ error: "Commande non créée." }, { status: 500 });
    }

    for (const item of items) {
      await neonQuery(
        `INSERT INTO order_items (
          order_id, product_id, product_name, quantity, price, size, color
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          item.productId,
          item.product_name,
          item.quantity,
          item.price,
          item.size ?? null,
          item.color ?? null,
        ]
      );
    }

    const emailPayload: OrderEmailPayload = {
      to: email,
      fullName,
      phone,
      orderId,
      items: items.map((it) => ({
        product_name: it.product_name,
        quantity: it.quantity,
        price: it.price,
        size: it.size ?? null,
        color: it.color ?? null,
        image_url: it.image_url ?? null,
      })),
      subtotal,
      shipping,
      discount: discountAmount,
      total,
      address,
      city,
      governorate,
    };

    const emailResult = await sendOrderEmails(emailPayload);

    return NextResponse.json({
      success: true,
      orderId,
      emailsSent: emailResult.adminSent && emailResult.clientSent,
      adminEmailSent: emailResult.adminSent,
      clientEmailSent: emailResult.clientSent,
      adminEmailId: emailResult.adminId,
      clientEmailId: emailResult.clientId,
      emailWarning: emailResult.error,
      adminError: emailResult.adminError,
      clientError: emailResult.clientError,
    });
  } catch (err) {
    console.error("[place-order] unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne." },
      { status: 500 }
    );
  }
}
