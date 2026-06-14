import { put } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";
import {
  templateOrderReceivedClient,
  textOrderReceivedClient,
  templateNewOrderAdmin,
  type OrderForEmail,
  type OrderItemForEmail,
} from "@/lib/emailTemplates";
import { getResend } from "@/lib/resendClient";

export const ADMIN_EMAIL =
  process.env.RESEND_ADMIN_EMAIL?.trim() || "vero7.tn@gmail.com";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "VERO7 <onboarding@resend.dev>";
const domainVerified = Boolean(process.env.RESEND_FROM_EMAIL?.trim());

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

const uploadCache = new Map<string, string>();

async function ensurePublicUrl(imageUrl: string | null | undefined): Promise<string> {
  if (!imageUrl) return "";
  const trimmed = imageUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  if (uploadCache.has(trimmed)) return uploadCache.get(trimmed)!;

  if (!process.env.BLOB_READ_WRITE_TOKEN) return "";

  try {
    const filePath = path.join(process.cwd(), "public", trimmed);
    if (!fs.existsSync(filePath)) return "";

    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const contentType = MIME[ext] || "image/jpeg";

    const blob = await put(`email-images/${path.basename(filePath)}`, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    uploadCache.set(trimmed, blob.url);
    return blob.url;
  } catch (err) {
    console.error("[sendOrderEmails] blob upload failed:", err);
    return "";
  }
}

export type OrderEmailPayload = {
  to: string;
  fullName: string;
  phone: string;
  orderId: number;
  items: {
    product_name: string;
    quantity: number;
    price: number;
    size?: string | null;
    color?: string | null;
    image_url?: string | null;
  }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  address: string;
  city: string;
  governorate: string;
};

export type SendOrderEmailsResult = {
  ok: boolean;
  adminSent: boolean;
  clientSent: boolean;
  error?: string;
  adminError?: string;
  clientError?: string;
  adminId?: string;
  clientId?: string;
};

async function sendWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    await new Promise((r) => setTimeout(r, 600));
    return await fn();
  }
}

export async function sendOrderEmails(body: OrderEmailPayload): Promise<SendOrderEmailsResult> {
  const resend = getResend();
  if (!resend) {
    return {
      ok: false,
      adminSent: false,
      clientSent: false,
      error: "Configuration email manquante (RESEND_API_KEY).",
    };
  }

  const order: OrderForEmail = {
    id: body.orderId,
    full_name: body.fullName,
    email: body.to,
    phone_number: body.phone || "",
    address: body.address,
    city: body.city,
    governorate: body.governorate,
    total_price: body.total,
    subtotal: body.subtotal,
    shipping: body.shipping,
    discount: body.discount,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  const items: OrderItemForEmail[] = await Promise.all(
    body.items.map(async (i) => ({
      product_name: i.product_name,
      quantity: i.quantity,
      price: i.price,
      size: i.size,
      color: i.color,
      image_url: await ensurePublicUrl(i.image_url),
    }))
  );

  const [adminResult, clientResult] = await Promise.all([
    sendWithRetry(() =>
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `Nouvelle commande #${body.orderId} — ${body.fullName}`,
        html: templateNewOrderAdmin(order, items),
      })
    ),
    sendWithRetry(() =>
      resend.emails.send({
        from: FROM_EMAIL,
        to: domainVerified ? body.to : ADMIN_EMAIL,
        replyTo: body.to,
        subject: domainVerified
          ? `Votre commande est confirmée — VERO7`
          : `[Client: ${body.to}] Votre commande est confirmée — VERO7`,
        html: templateOrderReceivedClient(order, items),
        text: textOrderReceivedClient(order, items),
      })
    ),
  ]);

  const adminSent = !adminResult.error;
  const clientSent = !clientResult.error;

  if (adminResult.error) console.error("[Resend] admin email error:", adminResult.error);
  if (clientResult.error) console.error("[Resend] client email error:", clientResult.error);

  if (!adminSent && !clientSent) {
    return {
      ok: false,
      adminSent: false,
      clientSent: false,
      error: "Erreur lors de l'envoi des emails.",
      adminError: adminResult.error?.message,
      clientError: clientResult.error?.message,
    };
  }

  return {
    ok: true,
    adminSent,
    clientSent,
    adminId: adminResult.data?.id,
    clientId: clientResult.data?.id,
    error: !clientSent
      ? "Email client non envoyé."
      : !adminSent
        ? "Email admin non envoyé."
        : undefined,
    adminError: adminResult.error?.message,
    clientError: clientResult.error?.message,
  };
}
