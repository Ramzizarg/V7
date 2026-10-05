"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ImageOff, Minus, X } from "lucide-react";
import type { AdsMetrics, TrendGranularity, TrendPoint } from "@/lib/metaAds";

export type Fmt = {
  money: (n: number | null | undefined) => string;
  int: (n: number | null | undefined) => string;
  compact: (n: number | null | undefined) => string;
  pct: (n: number | null | undefined, digits?: number) => string;
  roas: (n: number | null | undefined) => string;
  dec: (n: number | null | undefined, digits?: number) => string;
};

export function makeFmt(currency: string): Fmt {
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 });
  const int = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
  const dec = (n: number, d: number) => n.toFixed(d).replace(".", ",");
  return {
    money: (n) => (n == null ? "—" : money.format(n)),
    int: (n) => (n == null ? "—" : int.format(Math.round(n))),
    compact: (n) => (n == null ? "—" : compact.format(n)),
    pct: (n, d = 2) => (n == null ? "—" : `${dec(n, d)} %`),
    roas: (n) => (n == null ? "—" : `${dec(n, 2)}x`),
    dec: (n, d = 2) => (n == null ? "—" : dec(n, d)),
  };
}

export function statusInfo(status: string | null) {
  const s = (status ?? "").toUpperCase();
  if (s === "ACTIVE") return { label: "Active", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" };
  if (s.includes("PAUSED")) return { label: "En pause", dot: "bg-zinc-400", chip: "bg-zinc-100 text-zinc-600" };
  if (s === "ARCHIVED" || s === "DELETED") return { label: "Archivée", dot: "bg-zinc-300", chip: "bg-zinc-100 text-zinc-500" };
  if (s.includes("REVIEW") || s === "PENDING_BILLING_INFO")
    return { label: "En revue", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" };
  if (s.includes("DISAPPROVED") || s.includes("ISSUES"))
    return { label: "Problème", dot: "bg-red-500", chip: "bg-red-50 text-red-700" };
  return { label: s ? s.toLowerCase().replace(/_/g, " ") : "—", dot: "bg-zinc-300", chip: "bg-zinc-100 text-zinc-600" };
}

export function isActiveStatus(status: string | null) {
  return (status ?? "").toUpperCase() === "ACTIVE";
}

export function isPausedStatus(status: string | null) {
  return (status ?? "").toUpperCase().includes("PAUSED");
}

export function roasClass(roas: number | null) {
  if (roas == null) return "text-zinc-400";
  if (roas >= 2) return "text-emerald-600";
  if (roas >= 1) return "text-amber-600";
  return "text-red-600";
}

export function cpaClass(cpa: number | null, average: number | null) {
  if (cpa == null) return "text-zinc-400";
  if (average == null) return "text-zinc-900";
  if (cpa <= average) return "text-emerald-600";
  if (cpa <= average * 1.5) return "text-amber-600";
  return "text-red-600";
}

export function change(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export type GoodWhen = "up" | "down" | "neutral";

export function DeltaBadge({ value, goodWhen }: { value: number | null; goodWhen: GoodWhen }) {
  if (value == null) return null;
  const abs = Math.abs(value);
  if (abs < 0.005) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600">
        <Minus className="h-3 w-3" />0 %
      </span>
    );
  }
  const up = value > 0;
  const good = goodWhen === "neutral" ? null : (goodWhen === "up") === up;
  const color =
    good == null ? "bg-zinc-100 text-zinc-700" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${color}`}>
      <Icon className="h-3 w-3" />
      {(abs * 100).toFixed(abs >= 0.1 ? 0 : 1).replace(".", ",")} %
    </span>
  );
}

type IconType = ComponentType<{ className?: string }>;

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  goodWhen = "up",
  hint,
  featured = false,
}: {
  label: string;
  value: string;
  icon: IconType;
  delta: number | null;
  goodWhen?: GoodWhen;
  hint?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-4 sm:p-5 ${
        featured ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-black"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`truncate text-[11px] font-semibold uppercase tracking-wider ${featured ? "text-zinc-400" : "text-zinc-500"}`}>
          {label}
        </span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${featured ? "bg-white/10" : "bg-zinc-100"}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight tabular-nums sm:text-[28px]">{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        <DeltaBadge value={delta} goodWhen={goodWhen} />
        {hint ? <span className={`text-xs ${featured ? "text-zinc-400" : "text-zinc-500"}`}>{hint}</span> : null}
      </div>
    </div>
  );
}

export function MiniStat({
  label,
  value,
  delta,
  goodWhen = "up",
  hint,
}: {
  label: string;
  value: string;
  delta: number | null;
  goodWhen?: GoodWhen;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-lg font-bold tabular-nums text-black">{value}</span>
        <DeltaBadge value={delta} goodWhen={goodWhen} />
      </div>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-zinc-200 bg-white ${className}`}>{children}</section>;
}

export function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon?: IconType;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-bold text-black sm:text-lg">
          {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Pills<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "xs";
}) {
  return (
    <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
      <div className="inline-flex shrink-0 gap-1 rounded-full bg-zinc-100 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`whitespace-nowrap rounded-full font-semibold transition ${
              size === "xs" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
            } ${value === o.value ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("fr-FR", { ...opts, timeZone: "UTC" });
}

export function formatRange(range: { since: string; until: string } | null) {
  if (!range) return "";
  if (range.since === range.until) return formatDay(range.until, { weekday: "long", day: "numeric", month: "long" });
  const sameYear = range.since.slice(0, 4) === range.until.slice(0, 4);
  return `${formatDay(range.since, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })} – ${formatDay(range.until, { day: "numeric", month: "short", year: "numeric" })}`;
}

function trendLabel(key: string, granularity: TrendGranularity, long = false) {
  if (granularity === "hour") {
    const h = Number(key);
    return long ? `${h}h00 – ${h}h59` : `${h}h`;
  }
  if (granularity === "month") return formatDay(key, { month: long ? "long" : "short", year: "numeric" });
  return formatDay(key, long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
}

type TrendMetric = "spend" | "purchases" | "cpa" | "linkClicks" | "addToCart";

const TREND_METRICS: { value: TrendMetric; label: string }[] = [
  { value: "spend", label: "Dépenses" },
  { value: "purchases", label: "Achats" },
  { value: "cpa", label: "Coût/achat" },
  { value: "linkClicks", label: "Clics" },
  { value: "addToCart", label: "Paniers" },
];

function trendValue(p: TrendPoint, metric: TrendMetric) {
  if (metric === "cpa") return p.purchases > 0 ? p.spend / p.purchases : null;
  return p[metric];
}

export function TrendChart({
  points,
  granularity,
  fmt,
}: {
  points: TrendPoint[];
  granularity: TrendGranularity;
  fmt: Fmt;
}) {
  const [metric, setMetric] = useState<TrendMetric>("spend");
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => trendValue(p, metric));
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  const format = (v: number | null) => (metric === "spend" || metric === "cpa" ? fmt.money(v) : fmt.int(v));

  const totalSpend = points.reduce((s, p) => s + p.spend, 0);
  const totalPurchases = points.reduce((s, p) => s + p.purchases, 0);
  const summary =
    metric === "cpa"
      ? { label: "Moyenne", value: fmt.money(totalPurchases > 0 ? totalSpend / totalPurchases : null) }
      : { label: "Total", value: format(values.reduce<number>((s, v) => s + (v ?? 0), 0)) };

  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const point = active != null ? points[active] : null;

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <SectionTitle
        title="Évolution"
        subtitle={granularity === "hour" ? "Par heure" : granularity === "month" ? "Par mois" : "Par jour"}
        right={<Pills options={TREND_METRICS} value={metric} onChange={setMetric} size="xs" />}
      />

      <div className="mt-4 min-h-[52px] rounded-xl bg-zinc-50 px-3 py-2.5">
        {point ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-semibold capitalize text-black">{trendLabel(point.key, granularity, true)}</span>
            <span className="text-zinc-600">
              Dépenses <b className="text-black tabular-nums">{fmt.money(point.spend)}</b>
            </span>
            <span className="text-zinc-600">
              Achats <b className="text-black tabular-nums">{fmt.int(point.purchases)}</b>
            </span>
            <span className="text-zinc-600">
              Coût/achat{" "}
              <b className="text-black tabular-nums">{fmt.money(point.purchases > 0 ? point.spend / point.purchases : null)}</b>
            </span>
            <span className="text-zinc-600">
              Clics <b className="text-black tabular-nums">{fmt.int(point.linkClicks)}</b>
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{summary.label}</span>
            <span className="text-lg font-bold tabular-nums text-black">{summary.value}</span>
            <span className="hidden text-[11px] text-zinc-400 sm:inline">· survolez une barre pour le détail</span>
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-16 text-sm text-zinc-500">Pas de données sur cette période.</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <div className="flex h-44 w-12 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-zinc-400 sm:h-52">
            <span>{metric === "spend" || metric === "cpa" ? fmt.compact(max) : fmt.int(max)}</span>
            <span>{metric === "spend" || metric === "cpa" ? fmt.compact(max / 2) : fmt.int(max / 2)}</span>
            <span>0</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-44 sm:h-52" onPointerLeave={() => setActive(null)}>
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                <div className="border-t border-dashed border-zinc-200" />
                <div className="border-t border-dashed border-zinc-200" />
                <div className="border-t border-zinc-300" />
              </div>
              <div className="relative flex h-full items-end gap-[2px] sm:gap-1">
                {values.map((v, i) => {
                  const h = max > 0 && v != null ? Math.max((v / max) * 100, v > 0 ? 2 : 0) : 0;
                  const dim = active != null && active !== i;
                  return (
                    <button
                      key={points[i].key}
                      type="button"
                      onPointerEnter={() => setActive(i)}
                      onClick={() => setActive(i)}
                      aria-label={`${trendLabel(points[i].key, granularity, true)} : ${format(v)}`}
                      className="flex h-full min-w-0 flex-1 items-end"
                    >
                      <span
                        className={`block w-full rounded-t-[3px] transition-colors ${
                          metric === "purchases" ? "bg-emerald-500" : metric === "cpa" ? "bg-amber-500" : "bg-zinc-900"
                        } ${dim ? "opacity-25" : ""}`}
                        style={{ height: `${h}%` }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-1.5 flex gap-[2px] sm:gap-1">
              {points.map((p, i) => (
                <span key={p.key} className="relative h-4 min-w-0 flex-1">
                  {i % labelEvery === 0 ? (
                    <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-400">
                      {trendLabel(p.key, granularity)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function Funnel({ totals, fmt }: { totals: AdsMetrics; fmt: Fmt }) {
  const steps = [
    { label: "Impressions", value: totals.impressions, color: "bg-zinc-900" },
    { label: "Clics sur lien", value: totals.linkClicks, color: "bg-zinc-700" },
    { label: "Ajouts panier", value: totals.addToCart, color: "bg-zinc-500" },
    { label: "Commandes initiées", value: totals.initiateCheckout, color: "bg-zinc-400" },
    { label: "Achats", value: totals.purchases, color: "bg-emerald-500" },
  ];
  const top = Math.log10(steps[0].value + 1) || 1;
  const clickToPurchase = totals.linkClicks > 0 ? (totals.purchases / totals.linkClicks) * 100 : null;

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <SectionTitle title="Entonnoir" subtitle="De l'impression à l'achat" />
      <ol className="mt-4 flex flex-1 flex-col gap-1">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const rate = prev ? (s.value / prev) * 100 : null;
          const width = Math.max((Math.log10(s.value + 1) / top) * 100, s.value > 0 ? 4 : 1);
          return (
            <li key={s.label}>
              {i > 0 ? (
                <p className="py-0.5 pl-2 text-[10px] font-medium text-zinc-400">
                  ↓ {rate == null ? "—" : fmt.pct(rate, rate < 1 ? 2 : 1)}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-700">{s.label}</span>
                <span className="font-bold tabular-nums text-black">{fmt.int(s.value)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className={`h-full rounded-full ${s.color}`} style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-xs">
        <span className="font-medium text-emerald-800">Conversion clic → achat</span>
        <span className="font-bold tabular-nums text-emerald-800">{fmt.pct(clickToPurchase)}</span>
      </div>
    </Card>
  );
}

export function CreativeImage({ sources, alt, className = "" }: { sources: string[]; alt: string; className?: string }) {
  const [index, setIndex] = useState(0);
  const src = sources[index];
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-zinc-300">
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`h-full w-full object-cover ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black shadow ring-1 ring-black/5 hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-zinc-100 ${className}`} />;
}
