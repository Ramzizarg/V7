"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import { getCart, removeFromCartLine, updateCartQuantity } from "@/lib/shopClientStorage";
import type { CartItem } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
};

function lineUnit(item: CartItem) {
  const d = item.discountPrice;
  if (d != null && d < item.price) return d;
  return item.price;
}

function colorToHex(input?: string) {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return value;
  const key = value.toLowerCase();
  const known: Record<string, string> = {
    black: "#111111",
    blanc: "#ffffff",
    white: "#ffffff",
    noir: "#111111",
    red: "#dc2626",
    rouge: "#dc2626",
    blue: "#2563eb",
    bleu: "#2563eb",
    navy: "#1e3a8a",
    green: "#16a34a",
    vert: "#16a34a",
    jaune: "#facc15",
    yellow: "#facc15",
    gris: "#9ca3af",
    gray: "#9ca3af",
    grey: "#9ca3af",
    beige: "#d6c6a5",
    rose: "#f472b6",
    pink: "#f472b6",
    orange: "#f97316",
    violet: "#8b5cf6",
    purple: "#8b5cf6",
    marron: "#7c4a2b",
    brown: "#7c4a2b",
  };
  return known[key] ?? null;
}

export function CartSidebar({ open, onClose }: Props) {
  const { t, formatMoney, pluralArticles } = useTranslations();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const sync = () => setItems(getCart());
    sync();
    window.addEventListener("vero7-storage", sync);
    return () => window.removeEventListener("vero7-storage", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const itemCount = useMemo(() => items.reduce((a, b) => a + b.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((a, b) => a + lineUnit(b) * b.quantity, 0), [items]);
  const shipping = subtotal >= 200 ? 0 : subtotal > 0 ? 8 : 0;
  const total = subtotal + shipping;
  const isEmpty = items.length === 0;

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[120] bg-black/30 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-[121] flex h-dvh w-[min(92vw,360px)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[340px] md:w-[360px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t("cart.title")}
      >
        <div
          className={`flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 ${
            isEmpty ? "py-3.5 sm:py-3" : "py-4"
          }`}
        >
          <h2
            className={`font-black uppercase tracking-tight text-black ${
              isEmpty ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
            }`}
          >
            {isEmpty ? (
              t("cart.title")
            ) : (
              <>
                {t("cart.yourCart")}{" "}
                <span className="font-semibold normal-case text-zinc-500">
                  {t("cart.itemCount", { count: itemCount, articles: pluralArticles(itemCount) })}
                </span>
              </>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-black transition hover:bg-zinc-100"
            aria-label={t("cart.closeCart")}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          className={`flex min-h-0 flex-1 flex-col px-5 ${
            isEmpty ? "overflow-y-auto py-5 sm:overflow-hidden sm:py-3" : "overflow-y-auto py-6"
          }`}
        >
          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center px-1 py-4 text-center sm:justify-center sm:py-0">
              <div
                className="relative mb-5 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-white shadow-[0_8px_28px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] sm:mb-4 sm:h-[3.75rem] sm:w-[3.75rem]"
                aria-hidden
              >
                <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.04),transparent_55%)]" />
                <ShoppingBag className="relative h-9 w-9 text-zinc-800 sm:h-8 sm:w-8" strokeWidth={1.25} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:text-[9px]">
                {t("cart.empty")}
              </p>
              <h3 className="mt-1.5 max-w-[280px] text-xl font-black uppercase leading-tight tracking-tight text-black sm:mt-1 sm:text-lg">
                {t("cart.emptyTitle")}
              </h3>
              <p className="mt-2 max-w-[300px] text-pretty text-xs leading-snug text-zinc-600 sm:mt-1.5 sm:text-[11px] sm:leading-snug">
                {t("cart.emptyDesc")}
              </p>
              <ul className="mt-4 w-full max-w-[280px] space-y-1.5 text-left text-xs leading-snug text-zinc-600 sm:mt-3 sm:max-w-[260px] sm:space-y-1 sm:text-[10px]">
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-3 sm:w-3" aria-hidden />
                  <span>{t("cart.emptyPromo1")}</span>
                </li>
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-3 sm:w-3" aria-hidden />
                  <span>{t("cart.emptyPromo2")}</span>
                </li>
              </ul>
              <Link
                href="/"
                onClick={onClose}
                className="mt-5 text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition hover:text-black hover:decoration-black/40 sm:mt-3 sm:text-[10px]"
              >
                {t("cart.backHome")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item, index) => {
                const linePrice = lineUnit(item);
                const hasDiscount = item.discountPrice != null && item.discountPrice < item.price;
                return (
                  <li
                    key={`${item.productId}-${item.size ?? ""}-${item.color ?? ""}-${index}`}
                    className="border-b border-zinc-200 pb-4"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded bg-zinc-100">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="96px"
                            loading="lazy"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">—</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate pr-2 text-lg font-semibold leading-tight tracking-tight text-black">
                            {item.name}
                          </p>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-bold leading-none text-black">{formatMoney(linePrice)}</p>
                            {hasDiscount ? (
                              <div className="mt-1 flex items-center justify-end gap-2">
                                <span className="text-sm font-bold leading-none text-red-600">
                                  -{Math.round(((item.price - linePrice) / item.price) * 100)}%
                                </span>
                                <span className="text-sm leading-none text-zinc-400 line-through">
                                  {formatMoney(item.price)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 text-base leading-tight text-zinc-600">
                          {t("cart.sizeLabel")} {item.size ?? t("common.standard")}
                        </p>
                        {item.color ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-base leading-tight text-zinc-600">{t("cart.colorLabel")}</span>
                            <span
                              className="inline-block h-4 w-4 rounded-sm border border-black/20"
                              style={
                                colorToHex(item.color)
                                  ? { backgroundColor: colorToHex(item.color)! }
                                  : { background: "linear-gradient(to bottom right, rgb(244 244 245), rgb(212 212 216))" }
                              }
                              title={item.color}
                              aria-label={t("cart.colorAria", { color: item.color })}
                            />
                          </div>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => removeFromCartLine(item)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700"
                            aria-label={t("common.removeItem")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex h-7 items-center border border-zinc-300 sm:h-8">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item, Math.max(0, item.quantity - 1))}
                              className="h-full w-8 text-lg text-zinc-700 hover:bg-zinc-50 sm:w-10 sm:text-xl"
                              aria-label={t("common.decreaseQty")}
                            >
                              −
                            </button>
                            <span className="flex h-full w-8 items-center justify-center border-x border-zinc-300 text-sm text-black sm:w-10 sm:text-base">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item, item.quantity + 1)}
                              className="h-full w-8 text-lg text-zinc-700 hover:bg-zinc-50 sm:w-10 sm:text-xl"
                              aria-label={t("common.increaseQty")}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className={`shrink-0 border-t border-zinc-200 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            isEmpty ? "pt-3 sm:pt-2.5" : "pt-4"
          }`}
        >
          {isEmpty ? (
            <div className="flex flex-col gap-2.5 sm:gap-2">
              <Link
                href="/collection"
                onClick={onClose}
                className="flex h-10 w-full items-center justify-center bg-black px-3 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 sm:h-9 sm:text-[9px]"
              >
                {t("cart.viewCollection")}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-full items-center justify-center border border-black bg-white px-3 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-black transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 sm:h-9 sm:text-[9px]"
              >
                {t("common.continue")}
              </button>
              <p className="pt-0.5 text-center text-[9px] leading-snug text-zinc-500 sm:text-[8px]">
                {t("cart.emptyFooter")}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-lg leading-none">
                <div className="flex items-center justify-between">
                  <span className="text-black">{t("cart.subtotal")}</span>
                  <span className="font-medium text-black">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t("cart.shipping")}</span>
                  <span className="font-medium text-black">{formatMoney(shipping)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 font-semibold">
                  <span className="text-black">{t("cart.total")}</span>
                  <span className="text-black">{formatMoney(total)}</span>
                </div>
              </div>

              <Link
                href="/panier"
                onClick={onClose}
                className="mt-4 block w-full bg-black px-5 py-3 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-zinc-800"
              >
                {t("cart.checkout")}
              </Link>
              <p className="mt-3 text-xs leading-tight text-zinc-600">{t("cart.checkoutNote")}</p>
            </>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
