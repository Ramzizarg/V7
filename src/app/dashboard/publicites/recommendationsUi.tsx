"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight, Gavel, PlayCircle, Sparkles, X } from "lucide-react";
import type { CreativeRow } from "@/lib/metaAds";
import { Card, CreativeImage, SectionTitle, statusInfo, type Fmt } from "./adsUi";
import { VERDICT_ORDER, VERDICTS, type CreativeAnalysis, type Recommendation, type Verdict } from "./recommendations";

const PRIORITY: Record<Recommendation["priority"], { label: string; chip: string; icon: string }> = {
  high: { label: "Urgent", chip: "bg-red-50 text-red-700", icon: "bg-red-50 text-red-600" },
  medium: { label: "Important", chip: "bg-amber-50 text-amber-700", icon: "bg-amber-50 text-amber-600" },
  low: { label: "Conseil", chip: "bg-blue-50 text-blue-700", icon: "bg-blue-50 text-blue-600" },
};

const PLAN_PREVIEW = 6;
const VERDICT_PREVIEW = 6;

export function VerdictChip({ verdict, size = "sm" }: { verdict: Verdict; size?: "xs" | "sm" }) {
  const sizeClass = size === "xs" ? "px-1.5 text-[9px] sm:px-2 sm:text-[10px]" : "px-2 text-[10px]";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full py-0.5 font-semibold ${sizeClass} ${VERDICTS[verdict].chip}`}>
      {VERDICTS[verdict].short}
    </span>
  );
}

function TestProgress({ test, verdict, fmt }: { test: { spent: number; needed: number }; verdict: Verdict; fmt: Fmt }) {
  const pct = test.needed > 0 ? Math.min((test.spent / test.needed) * 100, 100) : 0;
  return (
    <div className="mt-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/70">
        <div className={`h-full rounded-full ${VERDICTS[verdict].bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] tabular-nums text-zinc-500">
        Test : {fmt.money(test.spent)} / {fmt.money(test.needed)} ({Math.round(pct)} %)
      </p>
    </div>
  );
}

export function ActionPlan({
  items,
  shortPeriod,
  onJump,
}: {
  items: Recommendation[];
  shortPeriod: boolean;
  onJump: (verdict: Verdict) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, PLAN_PREVIEW);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-zinc-100 p-4 sm:p-5">
        <SectionTitle icon={Sparkles} title="Plan d'action" subtitle="Recommandations pour améliorer vos pubs, classées par priorité" />
        {shortPeriod ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            Période courte : recommandations indicatives. Choisissez 7 jours ou plus avant de couper ou scaler.
          </p>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-zinc-500">Rien d&apos;urgent sur cette période.</p>
      ) : (
        <ol className="divide-y divide-zinc-100">
          {visible.map((r) => {
            const p = PRIORITY[r.priority];
            return (
              <li key={r.id} className="flex gap-3 px-4 py-4 sm:px-5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${p.icon}`}>
                  <r.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.chip}`}>{p.label}</span>
                    <p className="text-sm font-semibold text-black">{r.title}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">{r.detail}</p>
                  {r.impact ? <p className="mt-1 text-xs font-semibold text-red-600">{r.impact}</p> : null}
                </div>
                {r.verdict ? (
                  <button
                    type="button"
                    onClick={() => onJump(r.verdict!)}
                    className="flex shrink-0 items-center gap-0.5 self-center rounded-full border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-black transition hover:bg-zinc-50"
                  >
                    <span className="hidden sm:inline">Voir</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {items.length > PLAN_PREVIEW ? (
        <div className="border-t border-zinc-100 p-3 text-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold text-black underline-offset-2 hover:underline"
          >
            {showAll ? "Voir moins" : `Voir les ${items.length} recommandations`}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

function sortForVerdict(list: CreativeRow[], verdict: Verdict) {
  const copy = [...list];
  if (verdict === "winner") {
    return copy.sort((a, b) => (a.costPerPurchase ?? Infinity) - (b.costPerPurchase ?? Infinity) || b.purchases - a.purchases);
  }
  if (verdict === "promising") return copy.sort((a, b) => b.purchases - a.purchases || b.ctr - a.ctr);
  return copy.sort((a, b) => b.spend - a.spend);
}

export function VerdictBoard({
  creatives,
  analyses,
  fmt,
  tab,
  onTab,
  targetCpaInput,
  onTargetCpaInput,
  defaultCpa,
  onOpen,
}: {
  creatives: CreativeRow[];
  analyses: Map<string, CreativeAnalysis>;
  fmt: Fmt;
  tab: Verdict;
  onTab: (v: Verdict) => void;
  targetCpaInput: string;
  onTargetCpaInput: (value: string) => void;
  defaultCpa: number | null;
  onOpen: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const groups = VERDICT_ORDER.map((v) => ({
    verdict: v,
    list: creatives.filter((c) => analyses.get(c.id)?.verdict === v),
  }));
  const current = sortForVerdict(groups.find((g) => g.verdict === tab)?.list ?? [], tab);
  const visible = showAll ? current : current.slice(0, VERDICT_PREVIEW);

  return (
    <div>
      <SectionTitle
        icon={Gavel}
        title="Verdict des créas"
        subtitle="Gagnantes, perdantes et créas pas encore assez testées"
        right={
          <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-3 pr-1">
              <label htmlFor="target-cpa" className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                CPA cible
              </label>
              <input
                id="target-cpa"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={targetCpaInput}
                placeholder={defaultCpa != null ? defaultCpa.toFixed(2) : "—"}
                onChange={(e) => onTargetCpaInput(e.target.value)}
                className="h-7 min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-black placeholder:text-zinc-400 focus:outline-none sm:w-20 sm:flex-none"
              />
              {targetCpaInput ? (
                <button
                  type="button"
                  onClick={() => onTargetCpaInput("")}
                  aria-label="Revenir au CPA moyen"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-black"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="pr-2 text-[10px] font-medium text-zinc-400">moyenne</span>
              )}
            </div>
            <p className="px-1 text-[10px] leading-snug text-zinc-400">
              Mettez votre coût max par commande (marge) pour un verdict plus juste.
            </p>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {groups.map(({ verdict, list }, i) => {
          const meta = VERDICTS[verdict];
          const active = tab === verdict;
          return (
            <button
              key={verdict}
              type="button"
              onClick={() => {
                onTab(verdict);
                setShowAll(false);
              }}
              aria-pressed={active}
              className={`min-w-0 rounded-2xl border px-3 py-2.5 text-left transition sm:p-3 ${
                i === groups.length - 1 ? "col-span-2 sm:col-span-1" : ""
              } ${active ? `${meta.soft} ring-2 ring-black/80` : "border-zinc-200 bg-white hover:border-zinc-300"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${meta.bar}`} />
                  <span className="truncate text-xs font-semibold text-black sm:hidden">{meta.label}</span>
                </span>
                <span className="text-xl font-bold tabular-nums text-black sm:text-2xl">{list.length}</span>
              </div>
              <p className="mt-1 hidden text-xs font-semibold text-black sm:block">{meta.label}</p>
              <p className="hidden text-[10px] leading-snug text-zinc-500 sm:block">{meta.description}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[11px] text-zinc-500 sm:hidden">
        <b className="font-semibold text-black">{VERDICTS[tab].label} :</b> {VERDICTS[tab].description}
      </p>

      <Card className="mt-3 overflow-hidden">
        {current.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">Aucune créa dans cette catégorie.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visible.map((c) => {
              const a = analyses.get(c.id)!;
              const status = statusInfo(c.status);
              const details = (
                <>
                  {a.test ? <TestProgress test={a.test} verdict={a.verdict} fmt={fmt} /> : null}
                  <span className="mt-1 block text-xs leading-snug text-zinc-700">→ {a.actions[0]}</span>
                  {a.reasons[0] ? (
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{a.reasons[0]}</span>
                  ) : null}
                </>
              );
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className="block w-full px-3 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-50 sm:flex sm:gap-4 sm:px-4 sm:py-4"
                  >
                    <span className="flex min-w-0 flex-1 gap-3">
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100 sm:h-20 sm:w-20">
                        <CreativeImage sources={[c.imageUrl, c.thumbnailUrl].filter((s): s is string => !!s)} alt={c.name} />
                        {c.isVideo ? <PlayCircle className="absolute bottom-1 right-1 h-3.5 w-3.5 text-white drop-shadow" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-black">{c.name}</span>
                          {a.cutTooEarly ? (
                            <span className="shrink-0 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                              Coupée trop tôt
                            </span>
                          ) : null}
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-[11px] text-zinc-500">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
                          <span className="shrink-0">{status.label}</span>
                          {a.daysLive != null ? <span className="shrink-0">· {a.daysLive} j</span> : null}
                          <span className="truncate">· {c.campaignName}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-zinc-900">{a.headline}</span>
                        <span className="hidden sm:block">{details}</span>
                      </span>
                    </span>

                    <span className="mt-2 block sm:hidden">{details}</span>

                    <span className="mt-2 grid grid-cols-4 gap-1.5 text-center text-xs tabular-nums sm:mt-0 sm:flex sm:shrink-0 sm:gap-5 sm:self-center sm:text-right">
                      <Stat label="Dépenses" value={fmt.money(c.spend)} />
                      <Stat label="Achats" value={fmt.int(c.purchases)} />
                      <Stat label="Coût/achat" value={fmt.money(c.costPerPurchase)} />
                      <Stat label="CTR" value={fmt.pct(c.ctr, 1)} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {current.length > VERDICT_PREVIEW ? (
          <div className="border-t border-zinc-100 p-3 text-center">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-semibold text-black underline-offset-2 hover:underline"
            >
              {showAll ? "Voir moins" : `Voir les ${current.length} créas`}
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="block min-w-0 rounded-lg bg-zinc-50 px-1 py-1.5 sm:w-[76px] sm:bg-transparent sm:p-0">
      <span className="block truncate text-[9px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <span className="block truncate text-[11px] font-semibold text-zinc-900 sm:text-xs">{value}</span>
    </span>
  );
}

export function VerdictDetail({ analysis: a, fmt }: { analysis: CreativeAnalysis; fmt: Fmt }) {
  const meta = VERDICTS[a.verdict];
  return (
    <div className={`mt-3 rounded-xl border px-3 py-2.5 ${meta.soft}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <VerdictChip verdict={a.verdict} />
        {a.cutTooEarly ? (
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">Coupée trop tôt</span>
        ) : null}
        <span className="text-[13px] font-semibold">{a.headline}</span>
        {a.daysLive != null ? <span className="text-[11px] opacity-70">· en ligne depuis {a.daysLive} j</span> : null}
      </div>
      {a.test ? <TestProgress test={a.test} verdict={a.verdict} fmt={fmt} /> : null}
      <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug">
        {a.actions.map((action) => (
          <li key={action} className="flex gap-1.5">
            <span>→</span>
            <span>{action}</span>
          </li>
        ))}
      </ul>
      {a.reasons.length ? (
        <ul className="mt-1.5 space-y-0.5 border-t border-current/10 pt-1.5 text-[10.5px] leading-snug opacity-80">
          {a.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
