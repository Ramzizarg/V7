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
  frequency: number | null;
};

export type TrendGranularity = "hour" | "day" | "month";

export type TrendPoint = {
  key: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  addToCart: number;
  purchases: number;
  purchaseValue: number;
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
  campaignId: string;
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
  range: { since: string; until: string } | null;
  previousRange: { since: string; until: string } | null;
  totals: AdsMetrics;
  previousTotals: AdsMetrics | null;
  trend: { granularity: TrendGranularity; points: TrendPoint[] };
  campaigns: CampaignRow[];
  creatives: CreativeRow[];
  fetchedAt: string;
};

type ActionEntry = { action_type?: string; value?: string };

type InsightRow = {
  date_start?: string;
  date_stop?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
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
  const { spend, impressions, reach, linkClicks, purchases, purchaseValue } = base;
  return {
    ...base,
    frequency: reach > 0 ? impressions / reach : null,
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

type CreativeDetails = {
  thumbnail_url?: string;
  image_url?: string;
  title?: string;
  body?: string;
  object_type?: string;
  video_id?: string;
  object_story_spec?: {
    link_data?: { picture?: string };
    video_data?: { image_url?: string; video_id?: string };
  };
  asset_feed_spec?: {
    images?: { url?: string }[];
    videos?: { thumbnail_url?: string; video_id?: string }[];
  };
};

type AdCreativeInfo = {
  id: string;
  effective_status?: string;
  creative?: CreativeDetails;
};

const CREATIVE_FIELDS_FULL =
  "thumbnail_url,image_url,title,body,object_type,video_id," +
  "object_story_spec{link_data{picture},video_data{image_url,video_id}}," +
  "asset_feed_spec{images{url},videos{thumbnail_url,video_id}}";
const CREATIVE_FIELDS_BASIC = "thumbnail_url,image_url,title,body,object_type,video_id";

async function graphGetByIds<T>(ids: string[], params: Record<string, string>, token: string) {
  const out = new Map<string, T>();
  for (let i = 0; i < ids.length; i += 50) {
    const res = await graphGet<Record<string, T>>("", { ...params, ids: ids.slice(i, i + 50).join(",") }, token);
    for (const [id, value] of Object.entries(res)) out.set(id, value);
  }
  return out;
}

async function fetchCreativeDetails(creativeIds: string[], token: string) {
  const size = { thumbnail_width: "480", thumbnail_height: "480" };
  try {
    return await graphGetByIds<CreativeDetails>(creativeIds, { ...size, fields: CREATIVE_FIELDS_FULL }, token);
  } catch (err) {
    console.warn("[metaAds] creative details (full) failed, retrying basic fields:", err);
  }
  try {
    return await graphGetByIds<CreativeDetails>(creativeIds, { fields: CREATIVE_FIELDS_BASIC }, token);
  } catch (err) {
    console.error("[metaAds] creative details failed:", err);
    return new Map<string, CreativeDetails>();
  }
}

async function fetchAdCreatives(adIds: string[], token: string) {
  const byId = new Map<string, AdCreativeInfo>();
  let ads: Map<string, { effective_status?: string; creative?: { id?: string } }>;
  try {
    ads = await graphGetByIds(adIds, { fields: "effective_status,creative{id}" }, token);
  } catch (err) {
    console.error("[metaAds] ad lookup failed:", err);
    return byId;
  }

  const creativeIds = [...new Set([...ads.values()].map((a) => a.creative?.id).filter((id): id is string => !!id))];
  const details = creativeIds.length ? await fetchCreativeDetails(creativeIds, token) : new Map<string, CreativeDetails>();

  for (const [id, ad] of ads) {
    byId.set(id, {
      id,
      effective_status: ad.effective_status,
      creative: ad.creative?.id ? details.get(ad.creative.id) : undefined,
    });
  }
  return byId;
}

function creativeImage(creative: CreativeDetails | undefined) {
  if (!creative) return null;
  return (
    creative.image_url ||
    creative.object_story_spec?.link_data?.picture ||
    creative.object_story_spec?.video_data?.image_url ||
    creative.asset_feed_spec?.images?.find((img) => img.url)?.url ||
    creative.asset_feed_spec?.videos?.find((v) => v.thumbnail_url)?.thumbnail_url ||
    null
  );
}

function creativeIsVideo(creative: CreativeDetails | undefined) {
  if (!creative) return false;
  return Boolean(
    creative.video_id ||
      creative.object_type === "VIDEO" ||
      creative.object_story_spec?.video_data?.video_id ||
      creative.asset_feed_spec?.videos?.length
  );
}

const INSIGHT_FIELDS = "spend,impressions,reach,inline_link_clicks,actions,action_values";

const DAY_MS = 86_400_000;

function parseDay(day: string) {
  return Date.parse(`${day}T00:00:00Z`);
}

function formatDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function previousRange(since: string, until: string) {
  const start = parseDay(since);
  const end = parseDay(until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const days = Math.round((end - start) / DAY_MS) + 1;
  return { since: formatDay(start - days * DAY_MS), until: formatDay(start - DAY_MS) };
}

function trendGranularity(preset: MetaAdsPreset): TrendGranularity {
  if (preset === "today" || preset === "yesterday") return "hour";
  if (preset === "maximum") return "month";
  return "day";
}

async function fetchTrend(
  accountId: string,
  preset: MetaAdsPreset,
  token: string
): Promise<{ granularity: TrendGranularity; points: TrendPoint[] }> {
  const granularity = trendGranularity(preset);
  const params: Record<string, string> = {
    level: "account",
    fields: INSIGHT_FIELDS,
    date_preset: preset,
    limit: "200",
  };
  if (granularity === "hour") params.breakdowns = "hourly_stats_aggregated_by_advertiser_time_zone";
  else params.time_increment = granularity === "month" ? "monthly" : "1";

  try {
    const rows = await graphGetAll<InsightRow>(`${accountId}/insights`, params, token);
    const points = rows
      .map((row) => {
        const m = metricsFromInsight(row);
        const key =
          granularity === "hour"
            ? (row.hourly_stats_aggregated_by_advertiser_time_zone ?? "").slice(0, 2)
            : row.date_start ?? "";
        return {
          key,
          spend: m.spend,
          impressions: m.impressions,
          linkClicks: m.linkClicks,
          addToCart: m.addToCart,
          purchases: m.purchases,
          purchaseValue: m.purchaseValue,
        };
      })
      .filter((p) => p.key)
      .sort((a, b) => a.key.localeCompare(b.key));
    return { granularity, points };
  } catch (err) {
    console.error("[metaAds] trend failed:", err);
    return { granularity, points: [] };
  }
}

async function fetchPreviousTotals(accountId: string, range: { since: string; until: string }, token: string) {
  try {
    const rows = await graphGetAll<InsightRow>(
      `${accountId}/insights`,
      { level: "account", fields: INSIGHT_FIELDS, time_range: JSON.stringify(range) },
      token
    );
    return metricsFromInsight(rows[0]);
  } catch (err) {
    console.error("[metaAds] previous period failed:", err);
    return null;
  }
}

export async function fetchMetaAdsReport(preset: MetaAdsPreset): Promise<MetaAdsReport> {
  const { token, accountId, configured } = getMetaAdsConfig();
  if (!configured) throw new Error("Meta Ads n'est pas configuré.");

  const [account, accountInsights, campaignList, campaignInsights, adInsights, trend] = await Promise.all([
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
        fields: `ad_id,ad_name,campaign_id,campaign_name,adset_name,${INSIGHT_FIELDS}`,
        date_preset: preset,
        limit: "300",
      },
      token
    ),
    fetchTrend(accountId, preset, token),
  ]);

  const totalsRow = accountInsights[0];
  const range =
    totalsRow?.date_start && totalsRow?.date_stop ? { since: totalsRow.date_start, until: totalsRow.date_stop } : null;
  const prevRange = range && preset !== "maximum" ? previousRange(range.since, range.until) : null;

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
  const [creativeInfo, previousTotals] = await Promise.all([
    fetchAdCreatives(
      adsWithSpend.map((row) => row.ad_id!),
      token
    ),
    prevRange ? fetchPreviousTotals(accountId, prevRange, token) : Promise.resolve(null),
  ]);

  const creatives: CreativeRow[] = adsWithSpend
    .map((row) => {
      const info = creativeInfo.get(row.ad_id!);
      const creative = info?.creative;
      return {
        id: row.ad_id!,
        name: row.ad_name ?? row.ad_id!,
        campaignId: row.campaign_id ?? "",
        campaignName: row.campaign_name ?? "",
        adsetName: row.adset_name ?? "",
        status: info?.effective_status ?? null,
        thumbnailUrl: creative?.thumbnail_url ?? null,
        imageUrl: creativeImage(creative),
        title: creative?.title ?? null,
        body: creative?.body ?? null,
        isVideo: creativeIsVideo(creative),
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
    range,
    previousRange: previousTotals ? prevRange : null,
    totals: metricsFromInsight(totalsRow),
    previousTotals,
    trend,
    campaigns,
    creatives,
    fetchedAt: new Date().toISOString(),
  };
}
