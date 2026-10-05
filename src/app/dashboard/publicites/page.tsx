"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Megaphone,
  Wallet,
  ShoppingBag,
  Target,
  TrendingUp,
  MousePointerClick,
  ShoppingCart,
  Eye,
  Trophy,
  PlayCircle,
  ImageOff,
} from "lucide-react";
import type { AdsMetrics, CampaignRow, CreativeRow, MetaAdsPreset, MetaAdsReport } from "@/lib/metaAds";

type ApiResponse = { configured: false } | { configured: true; report?: MetaAdsReport; error?: string };

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

const TOP_CREATIVES = 12;

function statusBadge(status: string | null) {
  const s = (status ?? "").toUpperCase();
  if (s === "ACTIVE") return { label: "Active", className: "bg-emerald-100 text-emerald-800" };
  if (s.includes("PAUSED")) return { label: "En pause", className: "bg-zinc-100 text-zinc-600" };
  if (s === "ARCHIVED" || s === "DELETED") return { label: "Archivée", className: "bg-zinc-100 text-zinc-500" };
  if (s.includes("REVIEW") || s === "PENDING_BILLING_INFO") return { label: "En revue", className: "bg-amber-100 text-amber-800" };
  if (s.includes("DISAPPROVED") || s.includes("ISSUES")) return { label: "Problème", className: "bg-red-100 text-red-800" };
  return { label: s ? s.toLowerCase().replace(/_/g, " ") : "—", className: "bg-zinc-100 text-zinc-600" };
}

function rankBadgeClass(rank: number) {
  if (rank === 1) return "bg-amber-400 text-black";
  if (rank === 2) return "bg-zinc-300 text-black";
  if (rank === 3) return "bg-orange-300 text-black";
  return "bg-black/70 text-white";
}

export default function DashboardPublicitesPage() {
  const [preset, setPreset] = useState<MetaAdsPreset>("last_7d");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const fetchReport = useCallback((p: MetaAdsPreset) => {
    const id = ++requestId.current;
    return fetch(`/api/backoffice/meta-ads?preset=${p}`, { cache: "no-store" })
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

  const load = (p: MetaAdsPreset) => {
    setPreset(p);
    setLoading(true);
    void fetchReport(p);
  };

  useEffect(() => {
    void fetchReport("last_7d");
  }, [fetchReport]);

  const report = data && data.configured ? data.report : undefined;
  const currency = report?.account.currency ?? "USD";

  const money = (n: number | null) =>
    n == null
      ? "—"
      : new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  const int = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
  const pct = (n: number) => `${n.toFixed(2)} %`;
  const roas = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}x`);

  const kpis = (t: AdsMetrics) => [
    { label: "Dépenses", value: money(t.spend), icon: Wallet, dark: true },
    { label: "Achats", value: int(t.purchases), icon: ShoppingBag },
    { label: "Coût / achat", value: money(t.costPerPurchase), icon: Target },
    { label: "ROAS", value: roas(t.roas), icon: TrendingUp, hint: t.purchaseValue > 0 ? `${money(t.purchaseValue)} de ventes` : undefined },
    { label: "Clics (liens)", value: int(t.linkClicks), icon: MousePointerClick, hint: `CTR ${pct(t.ctr)}` },
    { label: "Ajouts panier", value: int(t.addToCart), icon: ShoppingCart },
    { label: "Impressions", value: int(t.impressions), icon: Eye, hint: `Portée ${int(t.reach)}` },
    { label: "CPM", value: money(t.cpm), icon: Megaphone, hint: `CPC ${money(t.cpc)}` },
  ];

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-black">Publicités</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Campagnes et meilleures créas Facebook / Instagram
            {report ? ` · ${report.account.name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(preset)}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-50 disabled:opacity-50 sm:w-auto"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualiser
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => load(p.value)}
            aria-pressed={preset === p.value}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              preset === p.value ? "bg-black text-white" : "border border-zinc-300 bg-white text-zinc-600 hover:text-black"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {data && !data.configured ? (
        <SetupInstructions />
      ) : loading && !report ? (
        <p className="flex items-center justify-center gap-2 py-20 text-sm uppercase tracking-wider text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </p>
      ) : report ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {kpis(report.totals).map((k) => (
              <div
                key={k.label}
                className={`flex flex-col rounded-xl border px-4 py-4 ${
                  k.dark ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-black"
                }`}
              >
                <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-medium uppercase tracking-wider opacity-70 sm:text-xs">
                    {k.label}
                  </span>
                  <k.icon className="h-5 w-5 shrink-0 opacity-60" />
                </div>
                <span className="text-lg font-bold tabular-nums sm:text-xl">{k.value}</span>
                {k.hint ? <span className="mt-1 text-[10px] opacity-70">{k.hint}</span> : null}
              </div>
            ))}
          </div>

          <CreativesSection creatives={report.creatives} money={money} int={int} pct={pct} roas={roas} />
          <CampaignsSection campaigns={report.campaigns} money={money} int={int} pct={pct} roas={roas} />
        </div>
      ) : null}
    </div>
  );
}

type Formatters = {
  money: (n: number | null) => string;
  int: (n: number) => string;
  pct: (n: number) => string;
  roas: (n: number | null) => string;
};

function CreativesSection({ creatives, money, int, pct, roas }: { creatives: CreativeRow[] } & Formatters) {
  const top = creatives.slice(0, TOP_CREATIVES);
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h2 className="text-base font-bold uppercase tracking-wider text-black sm:text-lg">Meilleures créas</h2>
      </div>
      <p className="mb-4 text-xs text-zinc-500">Classées par achats, puis coût par achat, puis CTR.</p>
      {top.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
          Aucune publicité diffusée sur cette période.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((c, i) => {
            const badge = statusBadge(c.status);
            const img = c.thumbnailUrl || c.imageUrl;
            return (
              <article key={c.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="relative aspect-square bg-zinc-100">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-bold ${rankBadgeClass(i + 1)}`}
                  >
                    #{i + 1}
                  </span>
                  {c.isVideo ? (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                      <PlayCircle className="h-3 w-3" />
                      Vidéo
                    </span>
                  ) : null}
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold text-black">{c.name}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mb-3 truncate text-[11px] text-zinc-500">
                    {c.campaignName}
                    {c.adsetName ? ` · ${c.adsetName}` : ""}
                  </p>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <Metric label="Achats" value={int(c.purchases)} strong />
                    <Metric label="Coût/achat" value={money(c.costPerPurchase)} />
                    <Metric label="ROAS" value={roas(c.roas)} />
                    <Metric label="Dépenses" value={money(c.spend)} />
                    <Metric label="CTR" value={pct(c.ctr)} />
                    <Metric label="Paniers" value={int(c.addToCart)} />
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-1.5 py-2">
      <dt className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 truncate text-xs tabular-nums ${strong ? "font-bold text-black" : "font-semibold text-zinc-800"}`}>
        {value}
      </dd>
    </div>
  );
}

function CampaignsSection({ campaigns, money, int, pct, roas }: { campaigns: CampaignRow[] } & Formatters) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-base font-bold uppercase tracking-wider text-black sm:text-lg">Campagnes</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {campaigns.length} campagne{campaigns.length !== 1 ? "s" : ""} · actives ou avec dépenses sur la période
        </p>
      </div>
      {campaigns.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-zinc-500">Aucune campagne sur cette période.</p>
      ) : (
        <>
          <div className="divide-y divide-zinc-100 sm:hidden">
            {campaigns.map((c) => {
              const badge = statusBadge(c.status);
              return (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-black">{c.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <Metric label="Dépenses" value={money(c.spend)} strong />
                    <Metric label="Achats" value={int(c.purchases)} />
                    <Metric label="Coût/achat" value={money(c.costPerPurchase)} />
                    <Metric label="ROAS" value={roas(c.roas)} />
                    <Metric label="CTR" value={pct(c.ctr)} />
                    <Metric label="Paniers" value={int(c.addToCart)} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-600">
                  <th className="px-4 py-3 text-left font-semibold">Campagne</th>
                  <th className="px-4 py-3 text-left font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Dépenses</th>
                  <th className="px-4 py-3 text-right font-semibold">Achats</th>
                  <th className="px-4 py-3 text-right font-semibold">Coût / achat</th>
                  <th className="px-4 py-3 text-right font-semibold">ROAS</th>
                  <th className="px-4 py-3 text-right font-semibold">CTR</th>
                  <th className="px-4 py-3 text-right font-semibold">CPC</th>
                  <th className="px-4 py-3 text-right font-semibold">Paniers</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const badge = statusBadge(c.status);
                  return (
                    <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <span className="block font-medium text-black">{c.name}</span>
                        {c.objective ? (
                          <span className="block text-[11px] text-zinc-500">
                            {c.objective.replace(/^OUTCOME_/, "").toLowerCase().replace(/_/g, " ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(c.spend)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{int(c.purchases)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(c.costPerPurchase)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{roas(c.roas)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pct(c.ctr)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(c.cpc)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{int(c.addToCart)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SetupInstructions() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
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
