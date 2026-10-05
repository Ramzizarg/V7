"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ExternalLink,
  Eye,
  LayoutGrid,
  List,
  Megaphone,
  MousePointerClick,
  PlayCircle,
  RefreshCw,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import type { CampaignRow, CreativeRow, MetaAdsPreset, MetaAdsReport } from "@/lib/metaAds";
import {
  Card,
  CreativeImage,
  Funnel,
  KpiCard,
  MiniStat,
  Modal,
  Pills,
  SectionTitle,
  Skeleton,
  TrendChart,
  change,
  cpaClass,
  formatRange,
  isActiveStatus,
  isPausedStatus,
  makeFmt,
  roasClass,
  statusInfo,
  type Fmt,
} from "./adsUi";

type ApiResponse = { configured: false } | { configured: true; report?: MetaAdsReport; error?: string };
type IconType = ComponentType<{ className?: string }>;

const PRESETS: { value: MetaAdsPreset; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "last_7d", label: "7 jours" },
  { value: "last_14d", label: "14 jours" },
  { value: "last_30d", label: "30 jours" },
  { value: "this_month", label: "Ce mois" },
  { value: "last_month", label: "Mois dernier" },
  { value: "maximum", label: "Tout" },
];

type CreativeSort = "purchases" | "cpa" | "roas" | "ctr" | "spend";

const CREATIVE_SORTS: { value: CreativeSort; label: string }[] = [
  { value: "purchases", label: "Achats" },
  { value: "cpa", label: "Coût/achat" },
  { value: "roas", label: "ROAS" },
  { value: "ctr", label: "CTR" },
  { value: "spend", label: "Dépenses" },
];

type CampaignSortKey = "spend" | "purchases" | "costPerPurchase" | "roas" | "ctr" | "cpc" | "addToCart";
type CampaignStatusFilter = "all" | "active" | "paused";

const CREATIVES_PREVIEW = 12;

function compareNullable(a: number | null, b: number | null, dir: 1 | -1) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

function sortCreatives(list: CreativeRow[], sort: CreativeSort) {
  return [...list].sort((a, b) => {
    switch (sort) {
      case "cpa":
        return compareNullable(a.costPerPurchase, b.costPerPurchase, 1) || b.purchases - a.purchases;
      case "roas":
        return compareNullable(a.roas, b.roas, -1) || b.purchases - a.purchases;
      case "ctr":
        return b.ctr - a.ctr;
      case "spend":
        return b.spend - a.spend;
      default:
        return b.purchases - a.purchases || compareNullable(a.costPerPurchase, b.costPerPurchase, 1) || b.ctr - a.ctr;
    }
  });
}

function sortCampaigns(list: CampaignRow[], key: CampaignSortKey, dir: 1 | -1) {
  return [...list].sort((a, b) => compareNullable(a[key], b[key], dir) || b.spend - a.spend);
}

function rankBadgeClass(rank: number) {
  if (rank === 1) return "bg-amber-400 text-black";
  if (rank === 2) return "bg-zinc-200 text-black";
  if (rank === 3) return "bg-orange-300 text-black";
  return "bg-black/60 text-white backdrop-blur";
}

function creativeMetric(c: CreativeRow, key: CreativeSort, fmt: Fmt, avgCpa: number | null) {
  switch (key) {
    case "purchases":
      return { label: "Achats", value: fmt.int(c.purchases), className: c.purchases > 0 ? "text-black" : "text-zinc-400" };
    case "cpa":
      return { label: "Coût/achat", value: fmt.money(c.costPerPurchase), className: cpaClass(c.costPerPurchase, avgCpa) };
    case "roas":
      return { label: "ROAS", value: fmt.roas(c.roas), className: roasClass(c.roas) };
    case "ctr":
      return { label: "CTR", value: fmt.pct(c.ctr), className: "text-black" };
    default:
      return { label: "Dépenses", value: fmt.money(c.spend), className: "text-black" };
  }
}

const SECONDARY_ORDER: CreativeSort[] = ["purchases", "cpa", "spend", "ctr", "roas"];

type Insight = { tone: "good" | "warn" | "info"; icon: IconType; title: string; text: string };

function buildInsights(report: MetaAdsReport, fmt: Fmt): Insight[] {
  const { totals, creatives, campaigns } = report;
  const out: Insight[] = [];

  const best = sortCreatives(
    creatives.filter((c) => c.purchases > 0),
    "purchases"
  )[0];
  if (best) {
    out.push({
      tone: "good",
      icon: Trophy,
      title: "Meilleure créa",
      text: `« ${best.name} » : ${fmt.int(best.purchases)} achat${best.purchases > 1 ? "s" : ""} à ${fmt.money(best.costPerPurchase)} l'achat.`,
    });
  }

  if (totals.costPerPurchase != null) {
    const wasted = creatives.filter((c) => c.purchases === 0 && c.spend >= totals.costPerPurchase!);
    if (wasted.length) {
      const sum = wasted.reduce((s, c) => s + c.spend, 0);
      const worst = [...wasted].sort((a, b) => b.spend - a.spend)[0];
      out.push({
        tone: "warn",
        icon: AlertTriangle,
        title: `${wasted.length} pub${wasted.length > 1 ? "s" : ""} sans achat`,
        text: `${fmt.money(sum)} dépensés sans vente (plus qu'un coût/achat moyen). La plus coûteuse : « ${worst.name} ».`,
      });
    }
  }

  const converting = campaigns.filter((c) => c.purchases > 0);
  if (converting.length > 1) {
    const top = sortCampaigns(converting, "costPerPurchase", 1)[0];
    out.push({
      tone: "info",
      icon: Target,
      title: "Campagne la plus rentable",
      text: `« ${top.name} » : ${fmt.money(top.costPerPurchase)} par achat${top.roas != null ? ` · ROAS ${fmt.roas(top.roas)}` : ""}.`,
    });
  }

  const hook = [...creatives].filter((c) => c.impressions >= 500).sort((a, b) => b.ctr - a.ctr)[0];
  if (hook && hook.id !== best?.id) {
    out.push({
      tone: "info",
      icon: MousePointerClick,
      title: "Accroche la plus forte",
      text: `« ${hook.name} » : CTR de ${fmt.pct(hook.ctr)}. Bonne base pour décliner de nouvelles créas.`,
    });
  }

  if (totals.frequency != null && totals.frequency >= 3) {
    out.push({
      tone: "warn",
      icon: Repeat,
      title: "Fréquence élevée",
      text: `Chaque personne a vu vos pubs ${fmt.dec(totals.frequency, 1)} fois en moyenne. Pensez à renouveler les créas.`,
    });
  }

  if (totals.linkClicks >= 100) {
    const atcRate = (totals.addToCart / totals.linkClicks) * 100;
    if (atcRate < 3) {
      out.push({
        tone: "warn",
        icon: ShoppingCart,
        title: "Peu d'ajouts panier",
        text: `Seulement ${fmt.pct(atcRate, 1)} des clics ajoutent au panier. Vérifiez la page produit (prix, photos, tailles).`,
      });
    }
  }

  return out.slice(0, 4);
}

const INSIGHT_TONES: Record<Insight["tone"], string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
};

function localDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Period = MetaAdsPreset | "custom";

export default function DashboardPublicitesPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [query, setQuery] = useState("preset=today");
  const [customOpen, setCustomOpen] = useState(false);
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creativeSort, setCreativeSort] = useState<CreativeSort>("purchases");
  const [creativeCampaign, setCreativeCampaign] = useState<string>("all");
  const [creativeView, setCreativeView] = useState<"grid" | "list">("grid");
  const [showAllCreatives, setShowAllCreatives] = useState(false);
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null);

  const [campaignSort, setCampaignSort] = useState<{ key: CampaignSortKey; dir: 1 | -1 }>({ key: "spend", dir: -1 });
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatusFilter>("all");

  const requestId = useRef(0);
  const creativesRef = useRef<HTMLDivElement>(null);

  const fetchReport = useCallback((q: string) => {
    const id = ++requestId.current;
    return fetch(`/api/backoffice/meta-ads?${q}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as (ApiResponse & { error?: string }) | null;
        if (!json) throw new Error(`Erreur (${res.status})`);
        if (!res.ok && "error" in json && json.error) throw new Error(json.error);
        if (id !== requestId.current) return;
        setData(json);
        setError(null);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Impossible de charger les publicités.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, []);

  const run = (q: string) => {
    setQuery(q);
    setLoading(true);
    setShowAllCreatives(false);
    void fetchReport(q);
  };

  const selectPreset = (p: MetaAdsPreset) => {
    setPeriod(p);
    setCustomOpen(false);
    run(`preset=${p}`);
  };

  const openCustom = () => {
    if (!customSince || !customUntil) {
      setCustomSince(report?.range?.since ?? localDay(-6));
      setCustomUntil(report?.range?.until ?? localDay());
    }
    setCustomOpen((v) => !v);
  };

  const customValid = !!customSince && !!customUntil && customSince <= customUntil;

  const applyCustom = () => {
    if (!customValid) return;
    setPeriod("custom");
    setCustomOpen(false);
    run(`since=${customSince}&until=${customUntil}`);
  };

  useEffect(() => {
    void fetchReport("preset=today");
  }, [fetchReport]);

  const report = data && data.configured ? data.report : undefined;
  const fmt = useMemo(() => makeFmt(report?.account.currency ?? "USD"), [report?.account.currency]);
  const totals = report?.totals;
  const prev = report?.previousTotals ?? null;
  const avgCpa = totals?.costPerPurchase ?? null;

  const insights = useMemo(() => (report ? buildInsights(report, fmt) : []), [report, fmt]);

  const creativeCampaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of report?.creatives ?? []) if (c.campaignId) map.set(c.campaignId, c.campaignName || c.campaignId);
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [report]);

  const sortedCreatives = useMemo(() => {
    const list = (report?.creatives ?? []).filter(
      (c) => creativeCampaign === "all" || c.campaignId === creativeCampaign
    );
    return sortCreatives(list, creativeSort);
  }, [report, creativeCampaign, creativeSort]);

  const visibleCreatives = showAllCreatives ? sortedCreatives : sortedCreatives.slice(0, CREATIVES_PREVIEW);
  const selectedIndex = sortedCreatives.findIndex((c) => c.id === selectedCreativeId);
  const selectedCreative = selectedIndex >= 0 ? sortedCreatives[selectedIndex] : null;

  const filteredCampaigns = useMemo(() => {
    const list = (report?.campaigns ?? []).filter((c) =>
      campaignStatus === "all" ? true : campaignStatus === "active" ? isActiveStatus(c.status) : isPausedStatus(c.status)
    );
    return sortCampaigns(list, campaignSort.key, campaignSort.dir);
  }, [report, campaignStatus, campaignSort]);

  const activeCampaigns = (report?.campaigns ?? []).filter((c) => isActiveStatus(c.status)).length;
  const closeModal = useCallback(() => setSelectedCreativeId(null), []);

  const focusCampaign = (campaignId: string) => {
    setCreativeCampaign(campaignId);
    setShowAllCreatives(false);
    creativesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleCampaignSort = (key: CampaignSortKey) => {
    setCampaignSort((s) =>
      s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "costPerPurchase" || key === "cpc" ? 1 : -1 }
    );
  };

  const accountNumber = report?.account.id.replace(/^act_/, "") ?? "";

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl pb-10">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Meta Ads</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-black sm:text-3xl">Publicités</h1>
          {report ? (
            <p className="mt-1 truncate text-sm text-zinc-500">
              {report.account.name} · {report.account.currency}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {report ? (
            <span className="hidden text-xs text-zinc-400 sm:inline">
              Mis à jour à{" "}
              {new Date(report.fetchedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => run(query)}
            disabled={loading}
            aria-label="Actualiser"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-black transition hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
          {PRESETS.map((p) => (
            <PeriodButton key={p.value} active={period === p.value} onClick={() => selectPreset(p.value)}>
              {p.label}
            </PeriodButton>
          ))}
          <PeriodButton active={period === "custom" || customOpen} onClick={openCustom}>
            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
            Personnalisé
          </PeriodButton>
        </div>

        {customOpen ? (
          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3 sm:inline-flex sm:items-end sm:gap-3">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
              <label className="block min-w-0">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Du</span>
                <input
                  type="date"
                  value={customSince}
                  max={customUntil || localDay()}
                  onChange={(e) => setCustomSince(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-2.5 text-sm text-black focus:border-black focus:outline-none"
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Au</span>
                <input
                  type="date"
                  value={customUntil}
                  min={customSince || undefined}
                  max={localDay()}
                  onChange={(e) => setCustomUntil(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-2.5 text-sm text-black focus:border-black focus:outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!customValid}
              className="mt-2 h-10 w-full rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40 sm:mt-0 sm:w-auto"
            >
              Appliquer
            </button>
          </div>
        ) : null}

        {report?.range ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium capitalize text-zinc-700">{formatRange(report.range)}</span>
            {report.previousRange ? <span className="text-zinc-400">· vs {formatRange(report.previousRange)}</span> : null}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {data && !data.configured ? (
        <SetupInstructions />
      ) : !report || !totals ? (
        loading ? <LoadingSkeleton /> : null
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              featured
              label="Dépenses"
              value={fmt.money(totals.spend)}
              icon={Wallet}
              delta={change(totals.spend, prev?.spend)}
              goodWhen="neutral"
            />
            <KpiCard
              label="Achats"
              value={fmt.int(totals.purchases)}
              icon={ShoppingBag}
              delta={change(totals.purchases, prev?.purchases)}
              hint={totals.purchaseValue > 0 ? fmt.money(totals.purchaseValue) : undefined}
            />
            <KpiCard
              label="Coût / achat"
              value={fmt.money(totals.costPerPurchase)}
              icon={Target}
              delta={change(totals.costPerPurchase, prev?.costPerPurchase)}
              goodWhen="down"
            />
            <KpiCard
              label="ROAS"
              value={fmt.roas(totals.roas)}
              icon={TrendingUp}
              delta={change(totals.roas, prev?.roas)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MiniStat label="CTR (lien)" value={fmt.pct(totals.ctr)} delta={change(totals.ctr, prev?.ctr)} />
            <MiniStat label="CPC" value={fmt.money(totals.cpc)} delta={change(totals.cpc, prev?.cpc)} goodWhen="down" />
            <MiniStat label="CPM" value={fmt.money(totals.cpm)} delta={change(totals.cpm, prev?.cpm)} goodWhen="down" />
            <MiniStat
              label="Clics sur lien"
              value={fmt.int(totals.linkClicks)}
              delta={change(totals.linkClicks, prev?.linkClicks)}
            />
            <MiniStat
              label="Ajouts panier"
              value={fmt.int(totals.addToCart)}
              delta={change(totals.addToCart, prev?.addToCart)}
              hint={totals.addToCart > 0 ? `${fmt.money(totals.spend / totals.addToCart)} / ajout` : undefined}
            />
            <MiniStat
              label="Portée"
              value={fmt.compact(totals.reach)}
              delta={change(totals.reach, prev?.reach)}
              hint={totals.frequency != null ? `Fréquence ${fmt.dec(totals.frequency, 1)}` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrendChart points={report.trend.points} granularity={report.trend.granularity} fmt={fmt} />
            </div>
            <Funnel totals={totals} fmt={fmt} />
          </div>

          {insights.length ? (
            <div>
              <SectionTitle icon={Sparkles} title="À retenir" subtitle="Analyse automatique de la période" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {insights.map((ins) => (
                  <Card key={ins.title} className="flex gap-3 p-4">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${INSIGHT_TONES[ins.tone]}`}>
                      <ins.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black">{ins.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{ins.text}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          <div ref={creativesRef} className="scroll-mt-36">
            <SectionTitle
              icon={Trophy}
              title="Créas"
              subtitle={`${sortedCreatives.length} publicité${sortedCreatives.length !== 1 ? "s" : ""} diffusée${sortedCreatives.length !== 1 ? "s" : ""} · cliquez pour le détail`}
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <Pills options={CREATIVE_SORTS} value={creativeSort} onChange={setCreativeSort} size="xs" />
                  <select
                    value={creativeCampaign}
                    onChange={(e) => {
                      setCreativeCampaign(e.target.value);
                      setShowAllCreatives(false);
                    }}
                    className="h-8 max-w-[220px] rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-black"
                    aria-label="Filtrer par campagne"
                  >
                    <option value="all">Toutes les campagnes</option>
                    {creativeCampaignOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="inline-flex rounded-full bg-zinc-100 p-1">
                    {(
                      [
                        { value: "grid", icon: LayoutGrid, label: "Grille" },
                        { value: "list", icon: List, label: "Liste" },
                      ] as const
                    ).map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setCreativeView(v.value)}
                        aria-label={v.label}
                        aria-pressed={creativeView === v.value}
                        className={`flex h-6 w-7 items-center justify-center rounded-full transition ${
                          creativeView === v.value ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"
                        }`}
                      >
                        <v.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              }
            />

            {report.warnings?.length ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                <div>
                  {report.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {creativeCampaign !== "all" ? (
              <button
                type="button"
                onClick={() => setCreativeCampaign("all")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1 text-xs font-medium text-white"
              >
                {creativeCampaignOptions.find((o) => o.value === creativeCampaign)?.label ?? "Campagne"}
                <X className="h-3 w-3" />
              </button>
            ) : null}

            <div className="mt-4">
              {sortedCreatives.length === 0 ? (
                <Card className="px-4 py-14 text-center text-sm text-zinc-500">Aucune publicité diffusée sur cette période.</Card>
              ) : creativeView === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  {visibleCreatives.map((c, i) => (
                    <CreativeCard
                      key={c.id}
                      creative={c}
                      rank={i + 1}
                      sort={creativeSort}
                      fmt={fmt}
                      avgCpa={avgCpa}
                      onOpen={() => setSelectedCreativeId(c.id)}
                    />
                  ))}
                </div>
              ) : (
                <CreativeList
                  creatives={visibleCreatives}
                  fmt={fmt}
                  avgCpa={avgCpa}
                  onOpen={(id) => setSelectedCreativeId(id)}
                />
              )}

              {sortedCreatives.length > CREATIVES_PREVIEW ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllCreatives((v) => !v)}
                    className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-xs font-semibold text-black transition hover:bg-zinc-50"
                  >
                    {showAllCreatives ? "Voir moins" : `Voir toutes les créas (${sortedCreatives.length})`}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-zinc-100 p-4 sm:p-5">
              <SectionTitle
                icon={Megaphone}
                title="Campagnes"
                subtitle={`${report.campaigns.length} campagne${report.campaigns.length !== 1 ? "s" : ""} · ${activeCampaigns} active${activeCampaigns !== 1 ? "s" : ""} · cliquez pour voir ses créas`}
                right={
                  <Pills
                    options={[
                      { value: "all" as const, label: "Toutes" },
                      { value: "active" as const, label: "Actives" },
                      { value: "paused" as const, label: "En pause" },
                    ]}
                    value={campaignStatus}
                    onChange={setCampaignStatus}
                    size="xs"
                  />
                }
              />
            </div>
            <CampaignsTable
              campaigns={filteredCampaigns}
              totalSpend={totals.spend}
              fmt={fmt}
              avgCpa={avgCpa}
              sort={campaignSort}
              onSort={toggleCampaignSort}
              onOpen={focusCampaign}
            />
          </Card>

          <p className="flex items-start gap-1.5 text-[11px] text-zinc-400">
            <Eye className="mt-px h-3 w-3 shrink-0" />
            Données Meta Ads (attribution Meta). Paiement à la livraison : « Achats » = commandes passées, pas livraisons confirmées.
          </p>
        </div>
      )}

      <Modal open={!!selectedCreative} onClose={closeModal}>
        {selectedCreative && totals ? (
          <CreativeDetail
            creative={selectedCreative}
            rank={selectedIndex + 1}
            sortLabel={CREATIVE_SORTS.find((s) => s.value === creativeSort)?.label ?? ""}
            totalSpend={totals.spend}
            avgCpa={avgCpa}
            fmt={fmt}
            accountNumber={accountNumber}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function PeriodButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-xs font-semibold transition sm:rounded-full sm:px-3.5 ${
        active ? "bg-black text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

function CreativeCard({
  creative: c,
  rank,
  sort,
  fmt,
  avgCpa,
  onOpen,
}: {
  creative: CreativeRow;
  rank: number;
  sort: CreativeSort;
  fmt: Fmt;
  avgCpa: number | null;
  onOpen: () => void;
}) {
  const status = statusInfo(c.status);
  const primary = creativeMetric(c, sort, fmt, avgCpa);
  const secondary = SECONDARY_ORDER.filter((k) => k !== sort)
    .slice(0, 3)
    .map((k) => creativeMetric(c, k, fmt, avgCpa));
  const noSale = avgCpa != null && c.purchases === 0 && c.spend >= avgCpa;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
        <CreativeImage
          sources={[c.imageUrl, c.thumbnailUrl].filter((s): s is string => !!s)}
          alt={c.name}
          className="transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2 sm:p-3">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm sm:px-2.5 sm:py-1 sm:text-xs ${rankBadgeClass(rank)}`}
          >
            #{rank}
          </span>
          {c.isVideo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 p-1 text-[10px] font-semibold text-white backdrop-blur sm:px-2">
              <PlayCircle className="h-3 w-3" />
              <span className="hidden sm:inline">Vidéo</span>
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 pt-10 sm:gap-2 sm:p-3 sm:pt-12">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-white sm:text-[11px]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
            <span className="truncate">{status.label}</span>
          </span>
          {noSale ? (
            <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold text-white sm:px-2 sm:text-[10px]">
              Sans achat
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-2.5 sm:p-4">
        <h3 className="truncate text-xs font-semibold text-black sm:text-sm">{c.name}</h3>
        <p className="truncate text-[10px] text-zinc-500 sm:text-[11px]">{c.campaignName}</p>
        <div className="mt-2 flex items-baseline justify-between gap-1 sm:mt-3 sm:gap-2">
          <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-[11px]">
            {primary.label}
          </span>
          <span className={`truncate text-base font-bold tabular-nums sm:text-xl ${primary.className}`}>{primary.value}</span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-1 text-center sm:mt-3 sm:grid-cols-3 sm:gap-1.5">
          {secondary.map((m, i) => (
            <div key={m.label} className={`rounded-lg bg-zinc-50 px-1 py-1.5 sm:px-1.5 sm:py-2 ${i === 2 ? "hidden sm:block" : ""}`}>
              <dt className="truncate text-[8px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-[9px]">{m.label}</dt>
              <dd className={`mt-0.5 truncate text-[11px] font-semibold tabular-nums sm:text-xs ${m.className}`}>{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </button>
  );
}

function CreativeList({
  creatives,
  fmt,
  avgCpa,
  onOpen,
}: {
  creatives: CreativeRow[];
  fmt: Fmt;
  avgCpa: number | null;
  onOpen: (id: string) => void;
}) {
  return (
    <Card className="divide-y divide-zinc-100 overflow-hidden">
      {creatives.map((c, i) => {
        const status = statusInfo(c.status);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-zinc-50 sm:px-4"
          >
            <span className="w-6 shrink-0 text-center text-xs font-bold text-zinc-400">{i + 1}</span>
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
              <CreativeImage sources={[c.thumbnailUrl, c.imageUrl].filter((s): s is string => !!s)} alt={c.name} />
              {c.isVideo ? <PlayCircle className="absolute bottom-1 right-1 h-3.5 w-3.5 text-white drop-shadow" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
                <span className="truncate text-sm font-semibold text-black">{c.name}</span>
              </span>
              <span className="block truncate text-[11px] text-zinc-500">{c.campaignName}</span>
            </span>
            <span className="grid shrink-0 grid-cols-3 gap-3 text-right text-xs tabular-nums sm:grid-cols-6 sm:gap-5">
              <ListValue label="Dépenses" value={fmt.money(c.spend)} />
              <ListValue label="Achats" value={fmt.int(c.purchases)} strong />
              <ListValue label="Coût/achat" value={fmt.money(c.costPerPurchase)} className={cpaClass(c.costPerPurchase, avgCpa)} />
              <ListValue label="ROAS" value={fmt.roas(c.roas)} className={roasClass(c.roas)} hideMobile />
              <ListValue label="CTR" value={fmt.pct(c.ctr)} hideMobile />
              <ListValue label="Paniers" value={fmt.int(c.addToCart)} hideMobile />
            </span>
          </button>
        );
      })}
    </Card>
  );
}

function ListValue({
  label,
  value,
  strong = false,
  className = "",
  hideMobile = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
  hideMobile?: boolean;
}) {
  return (
    <span className={hideMobile ? "hidden sm:block" : "block"}>
      <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <span className={`block ${strong ? "font-bold text-black" : "font-semibold text-zinc-800"} ${className}`}>{value}</span>
    </span>
  );
}

function SortTh({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: CampaignSortKey;
  sort: { key: CampaignSortKey; dir: 1 | -1 };
  onSort: (key: CampaignSortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-3 text-right font-semibold">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition ${active ? "text-black" : "hover:text-black"}`}
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-0"}`} />
      </button>
    </th>
  );
}

function CampaignsTable({
  campaigns,
  totalSpend,
  fmt,
  avgCpa,
  sort,
  onSort,
  onOpen,
}: {
  campaigns: CampaignRow[];
  totalSpend: number;
  fmt: Fmt;
  avgCpa: number | null;
  sort: { key: CampaignSortKey; dir: 1 | -1 };
  onSort: (key: CampaignSortKey) => void;
  onOpen: (id: string) => void;
}) {
  if (campaigns.length === 0) {
    return <p className="px-4 py-14 text-center text-sm text-zinc-500">Aucune campagne pour ce filtre.</p>;
  }
  const share = (spend: number) => (totalSpend > 0 ? Math.min((spend / totalSpend) * 100, 100) : 0);

  return (
    <>
      <div className="divide-y divide-zinc-100 md:hidden">
        {campaigns.map((c) => {
          const status = statusInfo(c.status);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              className="block w-full px-4 py-4 text-left transition active:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black">{c.name}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-black" style={{ width: `${share(c.spend)}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums text-black">{fmt.money(c.spend)}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <MobileMetric label="Achats" value={fmt.int(c.purchases)} />
                <MobileMetric label="Coût/achat" value={fmt.money(c.costPerPurchase)} className={cpaClass(c.costPerPurchase, avgCpa)} />
                <MobileMetric label="ROAS" value={fmt.roas(c.roas)} className={roasClass(c.roas)} />
                <MobileMetric label="CTR" value={fmt.pct(c.ctr, 1)} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70 text-[11px] text-zinc-500">
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Campagne</th>
              <SortTh label="Dépenses" sortKey="spend" sort={sort} onSort={onSort} />
              <SortTh label="Achats" sortKey="purchases" sort={sort} onSort={onSort} />
              <SortTh label="Coût/achat" sortKey="costPerPurchase" sort={sort} onSort={onSort} />
              <SortTh label="ROAS" sortKey="roas" sort={sort} onSort={onSort} />
              <SortTh label="CTR" sortKey="ctr" sort={sort} onSort={onSort} />
              <SortTh label="CPC" sortKey="cpc" sort={sort} onSort={onSort} />
              <SortTh label="Paniers" sortKey="addToCart" sort={sort} onSort={onSort} />
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const status = statusInfo(c.status);
              return (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="group cursor-pointer border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50"
                >
                  <td className="max-w-[280px] px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} title={status.label} />
                      <span className="truncate font-semibold text-black">{c.name}</span>
                    </div>
                    <p className="mt-0.5 pl-4 text-[11px] text-zinc-500">
                      {status.label}
                      {c.objective ? ` · ${c.objective.replace(/^OUTCOME_/, "").toLowerCase().replace(/_/g, " ")}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className="font-semibold tabular-nums text-black">{fmt.money(c.spend)}</span>
                    <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-black" style={{ width: `${share(c.spend)}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-black">{fmt.int(c.purchases)}</td>
                  <td className={`px-3 py-3.5 text-right font-semibold tabular-nums ${cpaClass(c.costPerPurchase, avgCpa)}`}>
                    {fmt.money(c.costPerPurchase)}
                  </td>
                  <td className={`px-3 py-3.5 text-right font-semibold tabular-nums ${roasClass(c.roas)}`}>{fmt.roas(c.roas)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-zinc-700">{fmt.pct(c.ctr)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-zinc-700">{fmt.money(c.cpc)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-zinc-700">{fmt.int(c.addToCart)}</td>
                  <td className="pr-3 text-zinc-300 transition group-hover:text-black">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileMetric({ label, value, className = "text-black" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-1 py-2">
      <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-semibold tabular-nums ${className}`}>{value}</p>
    </div>
  );
}

function CreativeDetail({
  creative: c,
  rank,
  sortLabel,
  totalSpend,
  avgCpa,
  fmt,
  accountNumber,
}: {
  creative: CreativeRow;
  rank: number;
  sortLabel: string;
  totalSpend: number;
  avgCpa: number | null;
  fmt: Fmt;
  accountNumber: string;
}) {
  const status = statusInfo(c.status);
  const rate = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
  const metrics: { label: string; value: string; className?: string }[] = [
    { label: "Dépenses", value: fmt.money(c.spend) },
    { label: "Achats", value: fmt.int(c.purchases) },
    { label: "Coût/achat", value: fmt.money(c.costPerPurchase), className: cpaClass(c.costPerPurchase, avgCpa) },
    { label: "ROAS", value: fmt.roas(c.roas), className: roasClass(c.roas) },
    { label: "Valeur achats", value: fmt.money(c.purchaseValue) },
    { label: "CTR (lien)", value: fmt.pct(c.ctr) },
    { label: "CPC", value: fmt.money(c.cpc) },
    { label: "CPM", value: fmt.money(c.cpm) },
    { label: "Impressions", value: fmt.int(c.impressions) },
    { label: "Portée", value: fmt.int(c.reach) },
    { label: "Fréquence", value: fmt.dec(c.frequency, 2) },
    { label: "Clics", value: fmt.int(c.linkClicks) },
    { label: "Ajouts panier", value: fmt.int(c.addToCart) },
    { label: "Cmd. initiées", value: fmt.int(c.initiateCheckout) },
    { label: "Part du budget", value: fmt.pct(rate(c.spend, totalSpend), 1) },
  ];
  const steps = [
    { label: "Clic → panier", value: rate(c.addToCart, c.linkClicks) },
    { label: "Panier → achat", value: rate(c.purchases, c.addToCart) },
    { label: "Clic → achat", value: rate(c.purchases, c.linkClicks) },
  ];

  return (
    <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="relative aspect-[4/5] bg-zinc-100 md:aspect-auto md:min-h-[560px]">
        <CreativeImage sources={[c.imageUrl, c.thumbnailUrl].filter((s): s is string => !!s)} alt={c.name} />
        <div className="absolute left-3 top-3 flex gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${rankBadgeClass(rank)}`}>
            #{rank} · {sortLabel}
          </span>
          {c.isVideo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
              <PlayCircle className="h-3 w-3" />
              Vidéo
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-5 sm:p-7">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <h3 className="mt-2 pr-10 text-xl font-bold tracking-tight text-black">{c.name}</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {c.campaignName}
          {c.adsetName ? ` · ${c.adsetName}` : ""}
        </p>

        {c.title || c.body ? (
          <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            {c.title ? <p className="text-sm font-semibold text-black">{c.title}</p> : null}
            {c.body ? (
              <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-zinc-600">{c.body}</p>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-5 grid grid-cols-3 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl bg-zinc-50 px-2.5 py-2">
              <dt className="truncate text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{m.label}</dt>
              <dd className={`mt-0.5 truncate text-sm font-bold tabular-nums ${m.className ?? "text-black"}`}>{m.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {steps.map((s) => (
            <div key={s.label} className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-2.5 py-2">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-emerald-700">{s.label}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-800">{fmt.pct(s.value, 1)}</p>
            </div>
          ))}
        </div>

        {accountNumber ? (
          <a
            href={`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accountNumber}&selected_ad_ids=${c.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Ouvrir dans Ads Manager
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5]" />
        ))}
      </div>
    </div>
  );
}

function SetupInstructions() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="mb-2 text-base font-bold">Connecter votre compte publicitaire Meta</h2>
      <p className="mb-3">
        Ajoutez ces deux variables dans Vercel (Settings → Environment Variables → Production), puis redéployez :
      </p>
      <ul className="mb-3 space-y-2">
        <li>
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">META_AD_ACCOUNT_ID</code> — l&apos;ID du
          compte publicitaire (Ads Manager, en haut à gauche, ex. <span className="font-mono">123456789012345</span>).
        </li>
        <li>
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">META_ADS_ACCESS_TOKEN</code> — un token
          d&apos;utilisateur système avec la permission <span className="font-mono">ads_read</span> (Business Settings →
          Utilisateurs système → Générer un token).
        </li>
      </ul>
      <p className="text-xs text-amber-800">Le token reste côté serveur et n&apos;est jamais envoyé au navigateur.</p>
    </div>
  );
}
