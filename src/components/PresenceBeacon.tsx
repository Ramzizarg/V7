"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "vero7-visitor-id";
const HEARTBEAT_MS = 20_000;

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `v7-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateVisitorId(): string {
  try {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    if (fromLocal && fromLocal.length >= 8) return fromLocal;
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession && fromSession.length >= 8) {
      localStorage.setItem(STORAGE_KEY, fromSession);
      return fromSession;
    }
    const id = createVisitorId();
    localStorage.setItem(STORAGE_KEY, id);
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    try {
      const fromSession = sessionStorage.getItem(STORAGE_KEY);
      if (fromSession && fromSession.length >= 8) return fromSession;
      const id = createVisitorId();
      sessionStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch {
      return createVisitorId();
    }
  }
}

function isStorefrontPath(path: string | null): boolean {
  if (!path) return false;
  return !/^\/(dashboard|api|backoffice|login)(\/|$)/i.test(path);
}

function currentPath(fallback: string | null): string {
  try {
    return window.location.pathname || fallback || "/";
  } catch {
    return fallback || "/";
  }
}

function sendHeartbeat(path: string, opts?: { beacon?: boolean }) {
  const visitorId = getOrCreateVisitorId();
  const payload = JSON.stringify({ visitorId, path });

  if (opts?.beacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/presence", blob);
      if (ok) return;
    } catch {
      // fall through to fetch
    }
  }

  void fetch("/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // never block UX
  });
}

/**
 * Silent storefront presence beacon (Shopify-style live visitors).
 * Uses localStorage visitor id + regular heartbeats + sendBeacon on hide.
 */
export function PresenceBeacon() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;

    const tick = (beacon = false) => {
      if (cancelled) return;
      const path = currentPath(pathRef.current);
      if (!isStorefrontPath(path)) return;
      if (!beacon && document.visibilityState === "hidden") return;
      sendHeartbeat(path, { beacon });
    };

    // Immediate ping after paint
    const startId = window.setTimeout(() => tick(false), 400);
    intervalId = window.setInterval(() => tick(false), HEARTBEAT_MS) as unknown as number;

    const onVisible = () => {
      if (document.visibilityState === "visible") tick(false);
    };
    const onHide = () => {
      tick(true);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      cancelled = true;
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  // Ping on every storefront route change
  useEffect(() => {
    if (!isStorefrontPath(pathname)) return;
    const t = window.setTimeout(() => {
      sendHeartbeat(currentPath(pathname));
    }, 200);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
