"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShopEmptyState } from "@/components/shop/ShopEmptyState";
import { ShopHeader } from "@/components/shop/ShopHeader";
import type { Product } from "@/lib/types";
import { addToCart, getWishlistIds, setWishlistIds } from "@/lib/shopClientStorage";

function useStorageTick() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = () => setN((x) => x + 1);
    window.addEventListener("vero7-storage", on);
    return () => window.removeEventListener("vero7-storage", on);
  }, []);
  return n;
}

function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M12 20s-6-3.7-8.3-7C1.6 9.7 3 6 6.4 6c2.1 0 3.2 1.2 3.6 2 .4-.8 1.5-2 3.6-2C17 6 18.4 9.7 16.3 13c-2.3 3.3-8.3 7-8.3 7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FavorisClient() {
  const tick = useStorageTick();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const wishIds = useMemo(() => new Set(getWishlistIds()), [tick]);

  useEffect(() => {
    let c = false;
    setLoading(true);
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ products?: Product[] }>)
      .then((d) => {
        if (!c) setProducts(d.products ?? []);
      })
      .catch(() => {
        if (!c) setProducts([]);
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [tick]);

  const favorisProducts = useMemo(
    () => products.filter((p) => wishIds.has(p.id)),
    [products, wishIds]
  );

  const removeFavorite = useCallback((id: number) => {
    setWishlistIds(getWishlistIds().filter((x) => x !== id));
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <ShopHeader active="favoris" breadcrumb={[{ label: "Favoris" }]} />
      <main className="mx-auto w-full max-w-[1600px] px-2 pb-20 pt-8 sm:px-5 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Favoris</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Vos articles enregistres sur cet appareil
        </p>

        {loading ? (
          <div
            className="mt-10 space-y-4 sm:mt-12"
            role="status"
            aria-label="Chargement des favoris"
          >
            <div className="h-8 w-40 animate-pulse rounded-md bg-zinc-200" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 sm:gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="space-y-3"
                >
                  <div className="aspect-[3/4] w-full animate-pulse rounded-lg bg-zinc-200" />
                  <div className="h-3 w-3/4 max-w-[8rem] animate-pulse rounded bg-zinc-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          </div>
        ) : favorisProducts.length === 0 ? (
          <ShopEmptyState variant="favoris" />
        ) : (
          <ul className="mt-10 grid list-none grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {favorisProducts.map((p, index) => {
              const src = p.images[0] ?? "/vero7-logo.png";
              const showDiscount =
                p.discount_price != null && p.discount_price < p.price;
              return (
                <li key={p.id} className="group text-left">
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100">
                    <div className="relative h-full w-full">
                      <Image
                        src={src}
                        alt={p.name}
                        fill
                        priority={index < 4}
                        loading={index < 4 ? "eager" : "lazy"}
                        fetchPriority={index < 2 ? "high" : "auto"}
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeFavorite(p.id);
                      }}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md border border-black/15 bg-white/95 font-semibold text-black shadow-sm backdrop-blur-sm transition hover:bg-white"
                      aria-label="Retirer des favoris"
                    >
                      <span className="text-base leading-none">×</span>
                    </button>
                  </div>
                  <div className="mt-3 space-y-1">
                    <h2 className="text-sm font-medium leading-snug sm:text-[15px]">{p.name}</h2>
                    <p className="text-sm text-zinc-500">
                      {showDiscount ? (
                        <>
                          <span className="text-zinc-400 line-through">
                            {p.price.toFixed(2)} <span className="text-zinc-300">DT</span>
                          </span>{" "}
                          <span className="text-black">
                            {p.discount_price!.toFixed(2)} <span className="text-zinc-400">DT</span>
                          </span>
                        </>
                      ) : (
                        <>
                          {p.price.toFixed(2)} <span className="text-zinc-400">DT</span>
                        </>
                      )}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          addToCart({
                            productId: p.id,
                            name: p.name,
                            price: p.price,
                            discountPrice: p.discount_price,
                            image: p.images[0],
                            quantity: 1,
                          });
                        }}
                        className="text-xs font-semibold uppercase tracking-wide text-black underline decoration-black/20 underline-offset-2 transition hover:decoration-black"
                      >
                        Ajouter au panier
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}


