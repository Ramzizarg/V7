"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ListOrdered, Users, X } from "lucide-react";

const POLL_MS = 5_000;

type PagePresence = { path: string; count: number };

type PresencePayload = {
  online?: number;
  windowSeconds?: number;
  pages?: PagePresence[];
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
  const [pages, setPages] = useState<PagePresence[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

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
        setPages(Array.isArray(data.pages) ? data.pages : []);
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

  useEffect(() => {
    if (!popupOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [popupOpen]);

  const countLabel = online == null ? "…" : online === 0 ? "0" : String(online);

  const peopleLabel =
    online == null
      ? "Chargement…"
      : online === 0
        ? "Personne en ligne"
        : online === 1
          ? "1 personne en ligne"
          : `${online} personnes en ligne`;

  const popup =
    popupOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="Fermer"
              onClick={() => setPopupOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Visiteurs par page"
              className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-black">Visiteurs par page</h2>
                  <p className="text-xs text-zinc-500">
                    {peopleLabel} · trié du plus au moins
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPopupOpen(false)}
                  className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-black"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {pages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    Aucun visiteur actif pour le moment.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {pages.map((p, i) => (
                      <li
                        key={`${p.path}-${i}`}
                        className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-black" title={p.path}>
                          {p.path}
                        </span>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-900">
                          {p.count}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (variant === "card") {
    return (
      <>
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
            <p className="pt-1 text-[10px] text-zinc-500">
              MAJ {updatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {error ? " · reconnexion…" : ""}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setPopupOpen(true)}
            className="mt-auto pt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 transition hover:bg-emerald-50"
          >
            <ListOrdered className="h-3.5 w-3.5" />
            Voir par page
          </button>
        </div>
        {popup}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPopupOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-emerald-300 transition hover:bg-emerald-500/25"
        title="Voir les visiteurs par page"
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
      </button>
      {popup}
    </>
  );
}
