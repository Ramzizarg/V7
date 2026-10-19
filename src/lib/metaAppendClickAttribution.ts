import { META_PIXEL_CURRENCY } from "@/lib/metaPixel.shared";
import {
  isMetaCapiConfigured,
  sendMetaServerEvent,
  type MetaCustomData,
  type MetaUserDataInput,
} from "@/lib/metaConversionsApi";

export type AppendClickAttributionInput = {
  /** Same order as the Purchase you already sent. */
  orderId: number | string;
  /** Unix seconds of the original Purchase event_time. */
  purchaseEventTime: number;
  /** Order value (TND) — used for attribution_value = value * share. */
  value: number;
  currency?: string;
  /** Meta click cookie `fb.1.<ts>.<fbclid>` — required for click attribution. */
  fbc?: string;
  fbp?: string;
  userData?: Omit<MetaUserDataInput, "fbc" | "fbp">;
  /** Same custom_data fields as Purchase (content_ids, contents, …). */
  customData?: Omit<MetaCustomData, "value" | "currency" | "order_id">;
  eventSourceUrl?: string;
  /**
   * Share of conversion credit for this Meta click (0–1).
   * Last-click Meta default = 1 when only Meta click is known.
   */
  attributionShare?: number;
  adId?: string | number;
  /** Override click time; default parsed from fbc. */
  touchpointTs?: number;
};

/** Parse touchpoint timestamp from `_fbc` = `fb.1.<creation_time_ms>.<fbclid>`. */
export function touchpointTsFromFbc(fbc: string | undefined): number | undefined {
  if (!fbc) return undefined;
  const parts = fbc.split(".");
  if (parts.length < 4 || parts[0] !== "fb") return undefined;
  const ms = Number(parts[2]);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.floor(ms / 1000);
}

/**
 * Meta developer task: send Conversions API `AppendClickAttribution`
 * with the same parameters as Purchase + attribution_share / attribution_value.
 *
 * Template shape matches Meta Payload Helper (original_event_data + attribution_data).
 * Only useful when the customer came from a Meta ad click (`fbc` present).
 */
export async function sendMetaAppendClickAttribution(input: AppendClickAttributionInput) {
  if (!isMetaCapiConfigured()) {
    return { sent: false as const, skipped: true as const };
  }

  const fbc = input.fbc?.trim();
  if (!fbc) {
    // No Meta click cookie → nothing to append (organic / direct / other channels).
    return { sent: false as const, skipped: true as const };
  }

  const share = Math.min(1, Math.max(0, input.attributionShare ?? 1));
  const value = Number(input.value) || 0;
  const currency = input.currency ?? META_PIXEL_CURRENCY;
  const orderId = String(input.orderId);
  const touchpointTs = input.touchpointTs ?? touchpointTsFromFbc(fbc);
  const now = Math.floor(Date.now() / 1000);

  try {
    const result = await sendMetaServerEvent({
      eventName: "AppendClickAttribution",
      eventId: `append-click-${orderId}`,
      eventTime: now,
      eventSourceUrl: input.eventSourceUrl || "https://vero-7.com/",
      userData: {
        ...input.userData,
        fbc,
        fbp: input.fbp,
        country: input.userData?.country ?? "tn",
      },
      customData: {
        ...input.customData,
        currency,
        order_id: orderId,
        // Keep value on custom_data for parity with Purchase; credit is also in attribution_value.
        value,
      },
      originalEventData: {
        event_name: "Purchase",
        event_time: input.purchaseEventTime,
        order_id: orderId,
        event_id: `order-${orderId}`,
      },
      attributionData: {
        attribution_share: share,
        attribution_value: Math.round(value * share * 100) / 100,
        touchpoint_ts: touchpointTs,
        ...(input.adId != null ? { ad_id: input.adId } : {}),
        attr_window_days: 7,
      },
    });

    if (result.skipped) return { sent: false as const, skipped: true as const };
    if (!result.ok) return { sent: false as const, skipped: false as const, error: result.error };
    return { sent: true as const, skipped: false as const };
  } catch (err) {
    console.error("[meta-append-click-attribution]", err);
    return {
      sent: false as const,
      skipped: false as const,
      error: err instanceof Error ? err.message : "error",
    };
  }
}
