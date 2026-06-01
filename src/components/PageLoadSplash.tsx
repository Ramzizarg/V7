"use client";

import { useLayoutEffect, useState } from "react";

const LOGO_SRC = "/V7/V7-2.png";
const SCALE_MS = 900;
const HOLD_MS = 150;
const FADE_MS = 450;

function shouldPlaySplash(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload" || nav?.type === "navigate";
}

/**
 * Full-screen white splash with V7 logo (small → large) on hard reload / first visit.
 * Skips client-side Next.js navigations (layout stays mounted).
 */
export function PageLoadSplash() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useLayoutEffect(() => {
    const active = document.documentElement.classList.contains("vero7-splash-active");
    if (!active || !shouldPlaySplash()) {
      document.documentElement.classList.remove("vero7-splash-active");
      document.documentElement.style.overflow = "";
      window.dispatchEvent(new Event("vero7-splash-done"));
      return;
    }

    setVisible(true);
    document.documentElement.style.overflow = "hidden";

    const fadeTimer = window.setTimeout(() => setExiting(true), SCALE_MS + HOLD_MS);
    const doneTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("vero7-splash-active");
      document.documentElement.style.overflow = "";
      setVisible(false);
      setExiting(false);
      window.dispatchEvent(new Event("vero7-splash-done"));
    }, SCALE_MS + HOLD_MS + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
      document.documentElement.classList.remove("vero7-splash-active");
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`vero7-splash-overlay fixed inset-0 z-[10000] flex items-center justify-center bg-white ${
        exiting ? "vero7-splash-overlay--exit" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label="Chargement Vero7"
    >
      {/* Native img: paints with splash immediately (no Next preload timing warning). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt="Vero7"
        width={200}
        height={200}
        decoding="async"
        fetchPriority="high"
        className={`vero7-splash-logo h-auto w-[min(44vw,180px)] object-contain sm:w-[min(32vw,220px)] ${
          exiting ? "" : "vero7-splash-logo--animate"
        }`}
      />
    </div>
  );
}
