import { NextRequest, NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { fetchMetaAdsReport, getMetaAdsConfig, META_ADS_PRESETS, type MetaAdsPreset } from "@/lib/metaAds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  if (!getMetaAdsConfig().configured) {
    return NextResponse.json({ configured: false });
  }

  const requested = req.nextUrl.searchParams.get("preset") ?? "last_7d";
  const preset: MetaAdsPreset = (META_ADS_PRESETS as readonly string[]).includes(requested)
    ? (requested as MetaAdsPreset)
    : "last_7d";

  try {
    const report = await fetchMetaAdsReport(preset);
    return NextResponse.json({ configured: true, report });
  } catch (err) {
    console.error("[api/backoffice/meta-ads]", err);
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Erreur Meta Ads." },
      { status: 502 }
    );
  }
}
