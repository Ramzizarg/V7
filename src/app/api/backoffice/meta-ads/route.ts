import { NextRequest, NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import {
  fetchMetaAdsReport,
  getMetaAdsConfig,
  isValidDay,
  META_ADS_PRESETS,
  type MetaAdsPeriod,
  type MetaAdsPreset,
} from "@/lib/metaAds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  if (!getMetaAdsConfig().configured) {
    return NextResponse.json({ configured: false });
  }

  const params = req.nextUrl.searchParams;
  const since = params.get("since");
  const until = params.get("until");

  let period: MetaAdsPeriod;
  if (since || until) {
    if (!since || !until || !isValidDay(since) || !isValidDay(until) || since > until) {
      return NextResponse.json({ configured: true, error: "Période invalide." }, { status: 400 });
    }
    period = { since, until };
  } else {
    const requested = params.get("preset") ?? "today";
    period = {
      preset: (META_ADS_PRESETS as readonly string[]).includes(requested) ? (requested as MetaAdsPreset) : "today",
    };
  }

  try {
    const report = await fetchMetaAdsReport(period);
    return NextResponse.json({ configured: true, report });
  } catch (err) {
    console.error("[api/backoffice/meta-ads]", err);
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Erreur Meta Ads." },
      { status: 502 }
    );
  }
}
