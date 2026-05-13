/**
 * Resend email templates — Zara-style: clean, minimal, black & white.
 * Adapted for Vero7 (www.vero-7.com).
 */

import { getSiteUrl } from "./siteUrl";

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDate(s: string): string {
  const formatted = new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });
  return `${formatted} (UTC+1)`;
}

const BASE_STYLES = `
  margin:0; padding:0; background-color:#f5f5f5;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px; line-height: 1.5; color: #1a1a1a;
  -webkit-font-smoothing: antialiased;
`;

const WRAPPER = `
  <div style="${BASE_STYLES} padding: 24px 0 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff;">
      <tr><td style="padding: 0 32px;">
`;

const EMAIL_HEAD = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
`;

function getHeaderHtml(): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000;">
    <tr>
      <td style="padding: 32px 28px; text-align: center; background-color: #000000;">
        <h1 style="margin:0; font-size:32px; font-weight:900; color:#ffffff; letter-spacing:0.15em; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">VERO7</h1>
      </td>
    </tr>
  </table>
`;
}

function getFooterHtml(): string {
  const base = getSiteUrl();
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
    <tr>
      <td style="padding: 24px 40px 12px 40px; font-size: 11px; color: #888888; text-align: center;">
        <p style="margin: 0 0 8px;">VERO7 — Premium sportswear</p>
        <p style="margin: 0;">
          <a href="${escapeHtml(base + "/collection")}" style="color:#000; text-decoration:underline;">Collection</a> &nbsp;&middot;&nbsp;
          <a href="${escapeHtml(base + "/shipping-terms")}" style="color:#000; text-decoration:underline;">Livraison</a> &nbsp;&middot;&nbsp;
          <a href="${escapeHtml(base)}" style="color:#000; text-decoration:underline;">Accueil</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 40px 32px 40px; text-align: center;">
        <p style="margin: 0 0 12px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #888;">FOLLOW US</p>
        <a href="https://www.facebook.com/vero7.tn" style="display:inline-block; background-color:#000; color:#fff; border-radius:20px; font-size:12px; font-weight:700; font-family:Arial,sans-serif; text-decoration:none; margin:0 4px; padding:8px 16px; letter-spacing:0.03em;">Facebook</a>
        <a href="https://www.instagram.com/vero7.tn" style="display:inline-block; background-color:#000; color:#fff; border-radius:20px; font-size:12px; font-weight:700; font-family:Arial,sans-serif; text-decoration:none; margin:0 4px; padding:8px 16px; letter-spacing:0.03em;">Instagram</a>
      </td>
    </tr>
  </table>
`;
}

const END_WRAPPER = `
      </td></tr>
    </table>
  </div>
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderItemForEmail = {
  product_name: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  image_url?: string | null;
};

export type OrderForEmail = {
  id: number;
  full_name: string;
  email: string | null;
  phone_number: string;
  address: string;
  city: string;
  governorate: string;
  total_price: number;
  subtotal: number;
  shipping: number;
  discount: number;
  status: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Client: order received
// ---------------------------------------------------------------------------

export function templateOrderReceivedClient(
  order: OrderForEmail,
  items: OrderItemForEmail[]
): string {
  const itemsRows = items
    .map((i) => {
      const imgSrc = resolveImageUrl(i.image_url);
      const initial = i.product_name.charAt(0).toUpperCase();
      const imgCell = imgSrc
        ? `<img src="${escapeHtml(imgSrc)}" alt="" width="80" height="80" style="display:block; width:80px; height:80px; object-fit:cover; background:#f0f0f0; border-radius:4px;" />`
        : `<div style="width:80px; height:80px; background:#000; border-radius:4px; text-align:center; line-height:80px; font-size:28px; font-weight:900; color:#fff; font-family:Arial,sans-serif;">${initial}</div>`;
      return `
    <tr>
      <td style="padding: 14px 14px 14px 0; border-bottom: 1px solid #eee; vertical-align: top; width: 80px;">${imgCell}</td>
      <td style="padding: 16px 0; border-bottom: 1px solid #eee;">
        <p style="margin:0 0 4px; font-weight: 600; color: #000;">${escapeHtml(i.product_name)}</p>
        <p style="margin:0; font-size: 12px; color: #666;">Qté: ${i.quantity}${i.size ? " &middot; " + escapeHtml(i.size) : ""}${i.color ? " &middot; " + escapeHtml(i.color) : ""}</p>
        <p style="margin: 8px 0 0; font-weight: 600;">${formatPrice(i.price * i.quantity)}</p>
      </td>
    </tr>`;
    })
    .join("");

  const discountRow =
    order.discount > 0
      ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #16a34a;">Remise</td><td style="padding: 4px 0; text-align: right; font-size: 14px; color: #16a34a;">&minus;${formatPrice(order.discount)}</td></tr>`
      : "";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>${EMAIL_HEAD}</head>
<body style="${BASE_STYLES}">
${WRAPPER}
${getHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding: 32px 0 24px;">
      <h1 style="margin:0 0 8px; font-size: 20px; font-weight: 700; color: #000;">MERCI POUR VOTRE COMMANDE</h1>
      <p style="margin:0; font-size: 13px; color: #666;">${formatDate(order.created_at)}</p>
    </td></tr>
    <tr><td style="padding: 0 0 24px;">
      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(order.full_name)},</p>
      <p style="margin:0; color: #333;">Nous avons bien reçu votre commande. Nous allons vous contacter par téléphone pour la confirmer.</p>
    </td></tr>
    <tr><td style="padding: 0 0 8px;">
      <p style="margin:0; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: #888;">ADRESSE DE LIVRAISON</p>
    </td></tr>
    <tr><td style="padding: 0 0 24px;">
      <p style="margin:0; color: #333;">${escapeHtml(order.address)}<br/>${escapeHtml(order.city)}, ${escapeHtml(order.governorate)}</p>
    </td></tr>
    <tr><td style="padding: 0 0 8px;">
      <p style="margin:0; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: #888;">DÉTAILS DE LA COMMANDE</p>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemsRows}
      </table>
    </td></tr>
    <tr><td style="padding: 24px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #666;">Sous-total</td>
          <td style="padding: 4px 0; text-align: right; font-size: 14px;">${formatPrice(order.subtotal)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #666;">Livraison</td>
          <td style="padding: 4px 0; text-align: right; font-size: 14px;">${formatPrice(order.shipping)}</td>
        </tr>
        ${discountRow}
      </table>
    </td></tr>
    <tr><td style="padding: 12px 0; border-top: 2px solid #000;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 0;"><p style="margin:0; font-size: 12px; color: #666;">Total</p></td>
          <td style="padding: 0; text-align: right;"><p style="margin:0; font-size: 18px; font-weight: 700; color: #000;">${formatPrice(order.total_price)}</p></td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding: 16px 0 0;">
      <p style="margin:0; font-size: 13px; color: #888; line-height: 1.5;">Paiement à la livraison (espèces).</p>
    </td></tr>
  </table>
${getFooterHtml()}
${END_WRAPPER}
</body>
</html>`;
}

export function textOrderReceivedClient(
  order: OrderForEmail,
  items: OrderItemForEmail[]
): string {
  const base = getSiteUrl();
  const lines = [
    "MERCI POUR VOTRE COMMANDE",
    formatDate(order.created_at),
    "",
    `Bonjour ${order.full_name},`,
    "Nous avons bien reçu votre commande. Nous allons vous contacter par téléphone pour la confirmer.",
    "",
    "ADRESSE DE LIVRAISON",
    order.address,
    `${order.city}, ${order.governorate}`,
    "",
    "DÉTAILS",
    ...items.map(
      (i) =>
        `${i.product_name} × ${i.quantity}${i.size ? ` (${i.size})` : ""}${i.color ? ` — ${i.color}` : ""} — ${formatPrice(i.price * i.quantity)}`
    ),
    "",
    `Total: ${formatPrice(order.total_price)}`,
    "",
    "— VERO7",
    `${base}/collection | ${base}/shipping-terms`,
  ];
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Client: order confirmed (called when admin confirms)
// ---------------------------------------------------------------------------

export function templateOrderConfirmedClient(order: OrderForEmail): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>${EMAIL_HEAD}</head>
<body style="${BASE_STYLES}">
${WRAPPER}
${getHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding: 32px 0 24px;">
      <h1 style="margin:0 0 8px; font-size: 20px; font-weight: 700; color: #000;">COMMANDE CONFIRMÉE</h1>
    </td></tr>
    <tr><td style="padding: 0 0 24px;">
      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(order.full_name)},</p>
      <p style="margin:0 0 8px; color: #333;">Votre commande a été confirmée.</p>
      <p style="margin:0; font-size: 18px; font-weight: 700;">${formatPrice(order.total_price)}</p>
      <p style="margin: 16px 0 0; color: #666; font-size: 13px;">Nous vous tiendrons informé(e) de la livraison.</p>
    </td></tr>
  </table>
${getFooterHtml()}
${END_WRAPPER}
</body>
</html>`;
}

export function textOrderConfirmedClient(order: OrderForEmail): string {
  const base = getSiteUrl();
  const lines = [
    "COMMANDE CONFIRMÉE",
    "",
    `Bonjour ${order.full_name},`,
    "Votre commande a été confirmée.",
    `Total: ${formatPrice(order.total_price)}`,
    "Nous vous tiendrons informé(e) de la livraison.",
    "",
    "— VERO7",
    `${base}/collection | ${base}/shipping-terms`,
  ];
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Admin: new order notification
// ---------------------------------------------------------------------------

export function templateNewOrderAdmin(
  order: OrderForEmail,
  items: OrderItemForEmail[]
): string {
  const itemsRows = items
    .map((i) => {
      const imgSrc = resolveImageUrl(i.image_url);
      const meta = [i.size, i.color].filter(Boolean).join(" / ");
      const adminInitial = i.product_name.charAt(0).toUpperCase();
      const imgHtml = imgSrc
        ? `<img src="${escapeHtml(imgSrc)}" alt="" width="72" height="72" style="display:block; width:72px; height:72px; object-fit:cover; background:#f0f0f0; border-radius:6px;" />`
        : `<div style="width:72px; height:72px; background:#000; border-radius:6px; text-align:center; line-height:72px; font-size:24px; font-weight:900; color:#fff; font-family:Arial,sans-serif;">${adminInitial}</div>`;
      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; vertical-align: top;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align: top; padding-right: 14px;">${imgHtml}</td>
              <td style="vertical-align: top;">
                <p style="margin:0 0 3px; font-weight:600; color:#000; font-size:14px;">${escapeHtml(i.product_name)}</p>
                ${meta ? `<p style="margin:0 0 3px; font-size:12px; color:#666;">${escapeHtml(meta)}</p>` : ""}
                <p style="margin:0; font-size:12px; color:#888;">Qté: ${i.quantity}</p>
              </td>
            </tr></table>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align:right; vertical-align:top;">
            <p style="margin:0; font-weight:600; font-size:14px; color:#000;">${formatPrice(i.price * i.quantity)}</p>
          </td>
        </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="fr">
<head>${EMAIL_HEAD}</head>
<body style="${BASE_STYLES}">
${WRAPPER}
${getHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding: 32px 0 24px;">
      <h1 style="margin:0 0 8px; font-size: 20px; font-weight: 700; color: #000;">NOUVELLE COMMANDE #${order.id}</h1>
      <p style="margin:0; font-size: 13px; color: #666;">${formatDate(order.created_at)}</p>
    </td></tr>
    <tr><td style="padding: 0 0 16px;">
      <p style="margin:0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: #888;">CLIENT</p>
      <p style="margin:0;">${escapeHtml(order.full_name)}</p>
      <p style="margin:4px 0 0;">${escapeHtml(order.phone_number)}</p>
      ${order.email ? `<p style="margin:4px 0 0;">${escapeHtml(order.email)}</p>` : ""}
    </td></tr>
    <tr><td style="padding: 0 0 16px;">
      <p style="margin:0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: #888;">ADRESSE</p>
      <p style="margin:0;">${escapeHtml(order.address)}, ${escapeHtml(order.city)}, ${escapeHtml(order.governorate)}</p>
    </td></tr>
    <tr><td style="padding: 0 0 8px;">
      <p style="margin:0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: #888;">ARTICLES</p>
    </td></tr>
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        ${itemsRows}
      </table>
    </td></tr>
    <tr><td style="padding: 16px 0 0; border-top: 2px solid #000;">
      <p style="margin:0; font-size: 18px; font-weight: 700;">Total: ${formatPrice(order.total_price)}</p>
    </td></tr>
  </table>
${getFooterHtml()}
${END_WRAPPER}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Newsletter welcome
// ---------------------------------------------------------------------------

export function templateNewsletterWelcome(email: string): string {
  const base = getSiteUrl();
  return `
<!DOCTYPE html>
<html lang="fr">
<head>${EMAIL_HEAD}</head>
<body style="${BASE_STYLES}">
${WRAPPER}
${getHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding: 32px 0 24px;">
      <h1 style="margin:0 0 8px; font-size: 20px; font-weight: 700; color: #000;">BIENVENUE CHEZ VERO7</h1>
    </td></tr>
    <tr><td style="padding: 0 0 24px;">
      <p style="margin:0 0 16px; color: #333;">
        Merci de vous être abonné(e) à notre newsletter.
        Profitez de <strong>-10&nbsp;%</strong> sur votre première commande&nbsp;:
      </p>
      <div style="text-align:center; margin: 24px 0;">
        <span style="display:inline-block; background:#000; color:#fff; font-size:24px; font-weight:900; letter-spacing:0.12em; padding:14px 36px;">WELCOME10</span>
      </div>
      <p style="margin:0; color: #666; font-size: 13px;">Restez connecté(e) pour les dernières nouveautés et offres exclusives.</p>
    </td></tr>
    <tr><td style="padding: 0 0 16px; text-align: center;">
      <a href="${escapeHtml(base + "/collection")}" style="display:inline-block; background:#000; color:#fff; font-size:14px; font-weight:700; text-decoration:none; padding:12px 28px;">Découvrir la collection</a>
    </td></tr>
  </table>
${getFooterHtml()}
${END_WRAPPER}
</body>
</html>`;
}
