"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  setWelcomeOfferStatus,
  shouldShowWelcomeOffer,
  WELCOME_OFFER_IMAGE_SRC,
} from "@/lib/welcomeOfferStorage";
import { trackMetaLead } from "@/lib/metaPixel";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

import { SPLASH_DONE_EVENT } from "@/lib/splashTransition";
const OPEN_DELAY_MS = 400;
const SPLASH_FALLBACK_MS = 2600;

function waitForWelcomeOpen(onReady: () => void): () => void {
  if (!shouldShowWelcomeOffer()) return () => {};

  let opened = false;
  const openOnce = () => {
    if (opened) return;
    opened = true;
    window.setTimeout(onReady, OPEN_DELAY_MS);
  };

  const onSplashDone = () => openOnce();
  window.addEventListener(SPLASH_DONE_EVENT, onSplashDone, { once: true });

  const splashActive = document.documentElement.classList.contains("vero7-splash-active");
  if (!splashActive) {
    const t = window.setTimeout(openOnce, 900);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(SPLASH_DONE_EVENT, onSplashDone);
    };
  }

  const fallback = window.setTimeout(openOnce, SPLASH_FALLBACK_MS);
  return () => {
    window.clearTimeout(fallback);
    window.removeEventListener(SPLASH_DONE_EVENT, onSplashDone);
  };
}

export function WelcomeOfferModal() {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const close = useCallback((reason: "dismissed" | "subscribed") => {
    setWelcomeOfferStatus(reason);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!shouldShowWelcomeOffer()) return;
    return waitForWelcomeOpen(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("dismissed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail || !trimmedName) return;
    setStatus("loading");
    try {
      const metaEventId = trackMetaLead({
        email: trimmedEmail,
        fullName: trimmedName,
        country: "tn",
      });
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: trimmedName, metaEventId }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      window.setTimeout(() => close("subscribed"), 1400);
    } catch {
      setStatus("error");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center overflow-hidden overscroll-none bg-black/55 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-offer-title"
      onClick={() => close("dismissed")}
    >
      <div
        className="relative flex w-full max-w-[min(100%,21.25rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[min(88dvh,500px)] sm:max-w-[42rem] sm:flex-row sm:items-stretch sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile: image header */}
        <div className="relative aspect-[3/2] w-full shrink-0 sm:hidden">
          <Image
            src={WELCOME_OFFER_IMAGE_SRC}
            alt=""
            fill
            sizes="340px"
            className="object-cover object-[center_30%]"
            priority
          />
          <button
            type="button"
            onClick={() => close("dismissed")}
            className="absolute right-2.5 top-2.5 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label={t("common.close")}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={() => close("dismissed")}
          className="absolute right-3 top-3 z-30 hidden h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 sm:flex"
          aria-label={t("common.close")}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-col overflow-hidden px-4 py-3.5 sm:flex-1 sm:justify-center sm:px-7 sm:py-7 lg:px-8">
          <div className="relative mx-auto h-9 w-[4.5rem] shrink-0 sm:hidden">
            <Image
              src="/V7/V7-2.png"
              alt="Vero7"
              fill
              sizes="72px"
              className="object-contain object-center"
              priority
            />
          </div>
          <h2
            id="welcome-offer-title"
            className="mt-1.5 text-[0.8rem] font-black uppercase leading-snug tracking-wide text-black sm:mt-0 sm:text-[1.35rem] sm:leading-tight sm:tracking-tight lg:text-2xl"
          >
            <span className="sm:hidden">{t("modals.welcomeTitleMobile")}</span>
            <span className="hidden sm:inline">{t("modals.welcomeTitleDesktop")}</span>
          </h2>
          <p className="mt-1.5 text-[10px] leading-snug text-zinc-600 sm:mt-3 sm:text-sm sm:leading-relaxed sm:text-[14px]">
            {t("modals.welcomeDesc")}
          </p>

          {status === "success" ? (
            <p className="mt-4 text-sm font-semibold text-black sm:mt-6">
              {t("modals.welcomeSuccess")}
            </p>
          ) : (
            <form className="mt-2.5 space-y-2 sm:mt-5 sm:space-y-3" onSubmit={handleSubmit}>
              <input
                type="text"
                name="name"
                autoComplete="name"
                required
                placeholder={t("modals.welcomeName")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (status !== "idle" && status !== "loading") setStatus("idle");
                }}
                className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/20 sm:py-2.5"
              />
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder={t("modals.welcomeEmail")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status !== "idle" && status !== "loading") setStatus("idle");
                }}
                className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/20 sm:py-2.5"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-black px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-zinc-800 disabled:opacity-60 sm:py-3"
              >
                {status === "loading" ? t("common.sending") : t("common.subscribe")}
              </button>
              {status === "error" ? (
                <p className="text-xs text-red-600">{t("modals.welcomeError")}</p>
              ) : null}
            </form>
          )}

          <p className="mt-2 text-[9px] leading-snug text-zinc-500 sm:mt-4 sm:text-[10px]">
            <span className="sm:hidden">{t("modals.welcomeLegalMobile")}</span>
            <span className="hidden sm:inline">{t("modals.welcomeLegalDesktop")}</span>
          </p>
        </div>

        {/* Desktop: image column */}
        <div className="relative hidden min-h-[380px] w-[38%] max-w-[280px] shrink-0 sm:block">
          <Image
            src={WELCOME_OFFER_IMAGE_SRC}
            alt={t("modals.welcomeImageAlt")}
            fill
            sizes="280px"
            className="object-cover object-center"
            priority
          />
        </div>
      </div>
    </div>
  );
}
