"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

const POLL_MS = 5_000;

type PresencePayload = {
  online?: number;
  windowSeconds?: number;
  recent?: { path: string; lastSeen: string }[];
};

type Props = {
  /** Compact badge for the header, or a full dashboard card. */
  variant?: "badge" | "card";
};

/**
 * Live “people on the site now” indicator for the backoffice (Shopify-style).
 */
export function DashboardOnlineVisitors({ variant = "badge" }: Props) {
  const [online, setOnline] = useState<number | null>(null);
  const [recent, setRecent] = useState<{ path: string; lastSeen: string }[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/presence?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const data = (await res.json().catch(() => null)) as PresencePayload | null;
        if (cancelled) return;
        if (!res.ok || typeof data?.online !== "number") {
          setError(true);
          return;
        }
        setOnline(data.online);
        setRecent(Array.isArray(data.recent) ? data.recent : []);
        setUpdatedAt(new Date());
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    void load();
    const id = window.setInterval(load, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const countLabel =
    online == null ? "…" : online === 0 ? "0" : String(online);

  const peopleLabel =
    online == null
      ? "Chargement…"
      : online === 0
        ? "Personne en ligne"
        : online === 1
          ? "1 personne en ligne"
          : `${online} personnes en ligne`;

  if (variant === "card") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-4 py-4 flex flex-col min-h-[7.5rem]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-emerald-800/80 truncate">
            En ligne maintenant
          </span>
          <Users className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-emerald-700" />
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-emerald-950 tabular-nums">{countLabel}</span>
        </div>
        <p className="mt-1 text-[11px] text-emerald-800/70">{peopleLabel}</p>
        {updatedAt ? (
          <p className="mt-auto pt-2 text-[10px] text-zinc-500">
            MAJ {updatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            {error ? " · reconnexion…" : ""}
          </p>
        ) : null}
        {recent.length > 0 ? (
          <ul className="mt-2 space-y-0.5 border-t border-emerald-100 pt-2">
            {recent.slice(0, 3).map((r, i) => (
              <li key={`${r.path}-${i}`} className="truncate text-[10px] text-zinc-500">
                {r.path}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-emerald-300"
      title="Visiteurs actifs sur le site boutique (5 dernières minutes)"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">
        {online == null ? "…" : `${online} en ligne`}
      </span>
    </div>
  );
}
