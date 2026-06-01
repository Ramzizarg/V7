"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SPLASH_DONE_EVENT, SPLASH_REQUEST_EVENT } from "@/lib/splashTransition";

const LOGO_SRC = "/V7/V7-2.png";
const SCALE_MS = 900;
const HOLD_MS = 150;
const FADE_MS = 450;

function shouldPlayInitialSplash(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload" || nav?.type === "navigate";
}

function dispatchSplashDone(): void {
  window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
}

/**
 * Full-screen white splash with V7 logo (small → large).
 * Runs on hard reload / first visit, and on `requestSplashTransition()` (logo → home).
 */
export function PageLoadSplash() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const finishSplash = useCallback(() => {
    clearTimers();
    document.documentElement.classList.remove("vero7-splash-active");
    document.documentElement.style.overflow = "";
    setVisible(false);
    setExiting(false);
    dispatchSplashDone();
  }, [clearTimers]);

  const startSplash = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.classList.remove("vero7-splash-active");
      document.documentElement.style.overflow = "";
      dispatchSplashDone();
      return;
    }

    clearTimers();
    document.documentElement.classList.add("vero7-splash-active");
    document.documentElement.style.overflow = "hidden";
    setVisible(true);
    setExiting(false);

    timersRef.current.push(
      window.setTimeout(() => setExiting(true), SCALE_MS + HOLD_MS),
      window.setTimeout(() => finishSplash(), SCALE_MS + HOLD_MS + FADE_MS)
    );
  }, [clearTimers, finishSplash]);

  useLayoutEffect(() => {
    const active = document.documentElement.classList.contains("vero7-splash-active");

    if (active && shouldPlayInitialSplash()) {
      startSplash();
    } else {
      document.documentElement.classList.remove("vero7-splash-active");
      document.documentElement.style.overflow = "";
      dispatchSplashDone();
    }

    const onRequest = () => startSplash();
    window.addEventListener(SPLASH_REQUEST_EVENT, onRequest);

    return () => {
      clearTimers();
      window.removeEventListener(SPLASH_REQUEST_EVENT, onRequest);
      document.documentElement.classList.remove("vero7-splash-active");
      document.documentElement.style.overflow = "";
    };
  }, [startSplash, clearTimers]);

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
