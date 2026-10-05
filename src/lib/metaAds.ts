/**
 * Meta Marketing API (read-only) for the back-office ads report.
 * Requires META_ADS_ACCESS_TOKEN (with `ads_read`) and META_AD_ACCOUNT_ID.
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const MAX_PAGES = 5;

export const META_ADS_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "this_month",
  "last_month",
  "maximum",
] as const;

export type MetaAdsPreset = (typeof META_ADS_PRESETS)[number];

export type AdsMetrics = {
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  ctr: number;
  cpc: number | null;
  cpm: number | null;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  purchaseValue: number;
  costPerPurchase: number | null;
  roas: number | null;
};

export type CampaignRow = AdsMetrics & {
  id: string;
  name: string;
  status: string;
  objective: string | null;
};

export type CreativeRow = AdsMetrics & {
  id: string;
  name: string;
  campaignName: string;
  adsetName: string;
  status: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  body: string | null;
  isVideo: boolean;
};

export type MetaAdsReport = {
  account: { id: string; name: string; currency: string; timezone: string | null };
  preset: MetaAdsPreset;
  totals: AdsMetrics;
  campaigns: CampaignRow[];
  creatives: CreativeRow[];
};

type ActionEntry = { action_type?: string; value?: string };

type InsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  actions?: ActionEntry[];
  action_values?: ActionEntry[];
};

/** Overlapping action types for the same conversion: take the first one present, never sum them. */
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
const ADD_TO_CART_TYPES = ["omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"];
const CHECKOUT_TYPES = [
  "omni_initiated_checkout",
  "initiate_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
];

export function getMetaAdsConfig() {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim() || "";
  const rawAccount = process.env.META_AD_ACCOUNT_ID?.trim() || "";
  const accountId = rawAccount ? (rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`) : "";
  return { token, accountId, configured: Boolean(token && accountId) };
}

function num(value: string | number | undefined | null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickAction(list: ActionEntry[] | undefined, types: string[]) {
  if (!list?.length) return 0;
  for (const type of types) {
    const hit = list.find((a) => a.action_type === type);
    if (hit) return num(hit.value);
  }
  return 0;
}

function buildMetrics(base: {
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  purchaseValue: number;
}): AdsMetrics {
  const { spend, impressions, linkClicks, purchases, purchaseValue } = base;
  return {
    ...base,
    ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
    cpc: linkClicks > 0 ? spend / linkClicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    costPerPurchase: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null,
  };
}

function metricsFromInsight(row: InsightRow | undefined): AdsMetrics {
  return buildMetrics({
    spend: num(row?.spend),
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    linkClicks: num(row?.inline_link_clicks),
    addToCart: pickAction(row?.actions, ADD_TO_CART_TYPES),
    initiateCheckout: pickAction(row?.actions, CHECKOUT_TYPES),
    purchases: pickAction(row?.actions, PURCHASE_TYPES),
    purchaseValue: pickAction(row?.action_values, PURCHASE_TYPES),
  });
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !body || body.error) {
    throw new Error(body?.error?.message || `Meta API error (${res.status})`);
  }
  return body;
}

async function graphGetAll<T>(path: string, params: Record<string, string>, token: string): Promise<T[]> {
  const first = await graphGet<{ data?: T[]; paging?: { next?: string } }>(path, params, token);
  const rows = [...(first.data ?? [])];
  let next = first.paging?.next;
  for (let page = 1; next && page < MAX_PAGES; page += 1) {
    const res = await fetch(next, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { data?: T[]; paging?: { next?: string } } | null;
    if (!res.ok || !body) break;
    rows.push(...(body.data ?? []));
    next = body.paging?.next;
  }
  return rows;
}

type AdCreativeInfo = {
  id: string;
  effective_status?: string;
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    title?: string;
    body?: string;
    object_type?: string;
    video_id?: string;
  };
};

async function fetchAdCreatives(adIds: string[], token: string) {
  const byId = new Map<string, AdCreativeInfo>();
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50);
    const res = await graphGet<Record<string, AdCreativeInfo>>(
      "",
      {
        ids: chunk.join(","),
        fields:
          "effective_status,creative.thumbnail_width(480).thumbnail_height(480){thumbnail_url,image_url,title,body,object_type,video_id}",
      },
      token
    );
    for (const [id, info] of Object.entries(res)) byId.set(id, { ...info, id });
  }
  return byId;
}

const INSIGHT_FIELDS = "spend,impressions,reach,inline_link_clicks,actions,action_values";

export async function fetchMetaAdsReport(preset: MetaAdsPreset): Promise<MetaAdsReport> {
  const { token, accountId, configured } = getMetaAdsConfig();
  if (!configured) throw new Error("Meta Ads n'est pas configuré.");

  const [account, accountInsights, campaignList, campaignInsights, adInsights] = await Promise.all([
    graphGet<{ id: string; name?: string; currency?: string; timezone_name?: string }>(
      accountId,
      { fields: "name,currency,timezone_name" },
      token
    ),
    graphGetAll<InsightRow>(
      `${accountId}/insights`,
      { level: "account", fields: INSIGHT_FIELDS, date_preset: preset },
      token
    ),
    graphGetAll<{ id: string; name: string; effective_status?: string; objective?: string }>(
      `${accountId}/campaigns`,
      { fields: "id,name,effective_status,objective", limit: "200" },
      token
    ),
    graphGetAll<InsightRow>(
      `${accountId}/insights`,
      { level: "campaign", fields: `campaign_id,campaign_name,${INSIGHT_FIELDS}`, date_preset: preset, limit: "200" },
      token
    ),
    graphGetAll<InsightRow>(
      `${accountId}/insights`,
      {
        level: "ad",
        fields: `ad_id,ad_name,campaign_name,adset_name,${INSIGHT_FIELDS}`,
        date_preset: preset,
        limit: "300",
      },
      token
    ),
  ]);

  const insightByCampaign = new Map(campaignInsights.map((row) => [row.campaign_id ?? "", row]));
  const campaigns: CampaignRow[] = campaignList
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.effective_status ?? "UNKNOWN",
      objective: c.objective ?? null,
      ...metricsFromInsight(insightByCampaign.get(c.id)),
    }))
    .filter((c) => c.spend > 0 || c.status === "ACTIVE")
    .sort((a, b) => b.spend - a.spend);

  const adsWithSpend = adInsights.filter((row) => row.ad_id && num(row.spend) > 0);
  const creativeInfo = await fetchAdCreatives(
    adsWithSpend.map((row) => row.ad_id!),
    token
  ).catch(() => new Map<string, AdCreativeInfo>());

  const creatives: CreativeRow[] = adsWithSpend
    .map((row) => {
      const info = creativeInfo.get(row.ad_id!);
      const creative = info?.creative;
      return {
        id: row.ad_id!,
        name: row.ad_name ?? row.ad_id!,
        campaignName: row.campaign_name ?? "",
        adsetName: row.adset_name ?? "",
        status: info?.effective_status ?? null,
        thumbnailUrl: creative?.thumbnail_url ?? null,
        imageUrl: creative?.image_url ?? null,
        title: creative?.title ?? null,
        body: creative?.body ?? null,
        isVideo: Boolean(creative?.video_id) || creative?.object_type === "VIDEO",
        ...metricsFromInsight(row),
      };
    })
    .sort(
      (a, b) =>
        b.purchases - a.purchases ||
        (a.costPerPurchase ?? Infinity) - (b.costPerPurchase ?? Infinity) ||
        b.ctr - a.ctr
    );

  return {
    account: {
      id: account.id,
      name: account.name ?? account.id,
      currency: account.currency ?? "USD",
      timezone: account.timezone_name ?? null,
    },
    preset,
    totals: metricsFromInsight(accountInsights[0]),
    campaigns,
    creatives,
  };
}
