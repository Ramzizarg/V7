"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShopEmptyState } from "@/components/shop/ShopEmptyState";
import { ShopHeader } from "@/components/shop/ShopHeader";
import type { CartItem } from "@/lib/types";
import { getCart, removeFromCartLine, setCart, updateCartQuantity } from "@/lib/shopClientStorage";

function useStorageTick() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = () => setN((x) => x + 1);
    window.addEventListener("vero7-storage", on);
    return () => window.removeEventListener("vero7-storage", on);
  }, []);
  return n;
}

function lineUnit(c: CartItem) {
  const d = c.discountPrice;
  if (d != null && d < c.price) return d;
  return c.price;
}

function lineSubtotal(c: CartItem) {
  return lineUnit(c) * c.quantity;
}

export default function PanierClient() {
  const tick = useStorageTick();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
  }, [tick]);

  const { subtotal, count } = useMemo(() => {
    const s = items.reduce((a, b) => a + lineSubtotal(b), 0);
    const c = items.reduce((a, b) => a + b.quantity, 0);
    return { subtotal: s, count: c };
  }, [items]);

  const clear = useCallback(() => {
    setCart([]);
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <ShopHeader active="panier" breadcrumb={[{ label: "Panier" }]} />
      <main className="mx-auto w-full max-w-[1600px] px-2 pb-20 pt-8 sm:px-5 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Panier</h1>
        {count > 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            {count} article{count > 1 ? "s" : ""} sur cet appareil
          </p>
        ) : null}

        {items.length === 0 ? (
          <ShopEmptyState variant="panier" />
        ) : (
          <div className="mx-auto mt-10 max-w-3xl">
            <ul className="divide-y divide-black/10 border-t border-black/10">
              {items.map((row, index) => {
                const key = `${row.productId}-${row.size ?? ""}-${row.color ?? ""}`;
                const src = row.image ?? "/vero7-logo.png";
                const unit = lineUnit(row);
                return (
                  <li key={key} className="flex gap-4 py-5">
                    <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden bg-zinc-100 sm:h-32 sm:w-24">
                      <Image
                        src={src}
                        alt={row.name}
                        fill
                        priority={index === 0}
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        sizes="96px"
                        className="object-cover object-center"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-medium leading-snug sm:text-base">{row.name}</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {unit.toFixed(2)} <span className="text-zinc-400">DT</span>
                        {row.discountPrice != null && row.discountPrice < row.price ? (
                          <span className="ml-2 text-xs text-zinc-400 line-through">
                            {row.price.toFixed(2)} DT
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center border border-black/15">
                          <button
                            type="button"
                            className="px-2.5 py-1 text-sm transition hover:bg-black/5"
                            onClick={() =>
                              updateCartQuantity(
                                { productId: row.productId, size: row.size, color: row.color },
                                row.quantity - 1
                              )
                            }
                            aria-label="Diminuer"
                          >
                            -
                          </button>
                          <span className="min-w-[2rem] text-center text-sm tabular-nums">
                            {row.quantity}
                          </span>
                          <button
                            type="button"
                            className="px-2.5 py-1 text-sm transition hover:bg-black/5"
                            onClick={() =>
                              updateCartQuantity(
                                { productId: row.productId, size: row.size, color: row.color },
                                row.quantity + 1
                              )
                            }
                            aria-label="Augmenter"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeFromCartLine({
                              productId: row.productId,
                              size: row.size,
                              color: row.color,
                            })
                          }
                          className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium tabular-nums sm:text-base">
                      {lineSubtotal(row).toFixed(2)} <span className="text-zinc-400">DT</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="relative mt-8 overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-b from-zinc-50/80 to-white p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] sm:p-6">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    -18deg,
                    transparent,
                    transparent 10px,
                    rgba(0, 0, 0, 0.02) 10px,
                    rgba(0, 0, 0, 0.02) 11px
                  )`,
                }}
                aria-hidden
              />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between text-sm sm:text-base">
                  <span className="font-medium text-zinc-700">Sous-total</span>
                  <span className="text-lg font-semibold tabular-nums tracking-tight">
                    {subtotal.toFixed(2)} <span className="text-sm font-medium text-zinc-500">DT</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-500">Livraison calculee a l&apos;etape suivante.</p>
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={clear}
                    className="order-2 rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium transition hover:border-black/35 hover:bg-white sm:order-1"
                  >
                    Vider le panier
                  </button>
                  <Link
                    href="/collection"
                    className="order-1 inline-flex items-center justify-center rounded-full bg-black px-6 py-2.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-zinc-800 sm:order-2"
                  >
                    Continuer les achats
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
