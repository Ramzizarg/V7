import {
  hashMetaCity,
  hashMetaCountry,
  hashMetaEmail,
  hashMetaName,
  hashMetaPhone,
  hashMetaState,
  splitFullName,
} from "@/lib/metaHash";
import { META_PIXEL_CURRENCY, META_PIXEL_ID } from "@/lib/metaPixel.shared";

export type MetaUserDataInput = {
  email?: string;
  phone?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

export type MetaCustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  content_category?: string;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  num_items?: number;
  search_string?: string;
};

export type MetaServerEvent = {
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  customData?: MetaCustomData;
  userData?: MetaUserDataInput;
};

type MetaCapiUserData = {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  country?: string[];
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

function buildUserData(input?: MetaUserDataInput): MetaCapiUserData | undefined {
  if (!input) return undefined;

  const { firstName: splitFn, lastName: splitLn } = splitFullName(input.fullName ?? "");
  const firstName = input.firstName ?? splitFn;
  const lastName = input.lastName ?? splitLn;

  const em = input.email ? hashMetaEmail(input.email) : null;
  const ph = input.phone ? hashMetaPhone(input.phone) : null;
  const fn = firstName ? hashMetaName(firstName) : null;
  const ln = lastName ? hashMetaName(lastName) : null;
  const ct = input.city ? hashMetaCity(input.city) : null;
  const st = input.state ? hashMetaState(input.state) : null;
  const country = hashMetaCountry(input.country ?? "tn");

  const userData: MetaCapiUserData = {};
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (ct) userData.ct = [ct];
  if (st) userData.st = [st];
  if (country) userData.country = [country];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  return Object.keys(userData).length > 0 ? userData : undefined;
}

export function isMetaCapiConfigured() {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN?.trim());
}

export async function sendMetaServerEvents(events: MetaServerEvent[]) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!accessToken || events.length === 0) {
    return { ok: false as const, skipped: true as const };
  }

  const pixelId = process.env.META_PIXEL_ID?.trim() || META_PIXEL_ID;
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();

  const payload = {
    data: events.map((event) => ({
      event_name: event.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.eventId,
      event_source_url: event.eventSourceUrl,
      action_source: "website",
      user_data: buildUserData(event.userData),
      custom_data: event.customData
        ? {
            currency: event.customData.currency ?? META_PIXEL_CURRENCY,
            ...event.customData,
          }
        : undefined,
    })),
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) {
    console.error("[meta-capi]", body?.error?.message ?? res.statusText);
    return { ok: false as const, skipped: false as const, error: body?.error?.message ?? res.statusText };
  }

  return { ok: true as const, skipped: false as const };
}

export async function sendMetaServerEvent(event: MetaServerEvent) {
  return sendMetaServerEvents([event]);
}
