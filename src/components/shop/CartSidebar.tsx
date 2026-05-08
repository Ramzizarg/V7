"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
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
        className={`fixed right-0 top-0 z-[121] flex h-dvh w-[80vw] max-w-[480px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-full ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Panier"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-2xl font-black uppercase tracking-tight text-black">
            Votre panier ({itemCount} {itemCount > 1 ? "articles" : "article"})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-black transition hover:bg-zinc-100"
            aria-label="Fermer le panier"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="text-base text-zinc-500">Votre panier est vide.</p>
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
                          <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
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
                            <p className="text-lg font-bold leading-none text-black">{linePrice.toFixed(2)} TND</p>
                            {hasDiscount ? (
                              <div className="mt-1 flex items-center justify-end gap-2">
                                <span className="text-sm font-bold leading-none text-red-600">
                                  -{Math.round(((item.price - linePrice) / item.price) * 100)}%
                                </span>
                                <span className="text-sm leading-none text-zinc-400 line-through">
                                  {item.price.toFixed(2)} TND
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 text-base leading-tight text-zinc-600">Taille : {item.size ?? "STANDARD"}</p>
                        {item.color ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-base leading-tight text-zinc-600">Couleur :</span>
                            <span
                              className="inline-block h-4 w-4 rounded-sm border border-black/20"
                              style={
                                colorToHex(item.color)
                                  ? { backgroundColor: colorToHex(item.color)! }
                                  : { background: "linear-gradient(to bottom right, rgb(244 244 245), rgb(212 212 216))" }
                              }
                              title={item.color}
                              aria-label={`Couleur ${item.color}`}
                            />
                          </div>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => removeFromCartLine(item)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700"
                            aria-label="Supprimer l'article"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex h-7 items-center border border-zinc-300 sm:h-8">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item, Math.max(0, item.quantity - 1))}
                              className="h-full w-8 text-lg text-zinc-700 hover:bg-zinc-50 sm:w-10 sm:text-xl"
                              aria-label="Diminuer la quantite"
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
                              aria-label="Augmenter la quantite"
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

        <div className="border-t border-zinc-200 px-5 pb-5 pt-4">
          <div className="space-y-2 text-lg leading-none">
            <div className="flex items-center justify-between">
              <span className="text-black">Sous-total</span>
              <span className="font-medium text-black">{subtotal.toFixed(2)} TND</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-black">Livraison</span>
              <span className="font-medium text-black">{shipping.toFixed(2)} TND</span>
            </div>
            <div className="flex items-center justify-between pt-1 font-semibold">
              <span className="text-black">Total (TTC)</span>
              <span className="text-black">{total.toFixed(2)} TND</span>
            </div>
          </div>

          <Link
            href="/panier"
            onClick={onClose}
            className="mt-4 block w-full bg-black px-5 py-3 text-center text-sm font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800"
          >
            Commander
          </Link>
          <p className="mt-3 text-xs leading-tight text-zinc-600">Les codes promo et les bons de reduction peuvent etre appliques a la commande.</p>
        </div>
      </aside>
    </>,
    document.body
  );
}
