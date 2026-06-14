"use client";

import Image from "next/image";
import { shouldBypassImageOptimization } from "@/lib/imageOptimize";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { ComingSoonPlaceholder } from "@/components/ComingSoonPlaceholder";
import {
  dispatchCartAdded,
  dispatchFavorisAdded,
  flyProductThumbnailToCart,
  flyProductThumbnailToFavorites,
} from "@/lib/favorisUx";
import { addToCart, getWishlistIds, toggleWishlistId } from "@/lib/shopClientStorage";
import { trackMetaAddToWishlist, trackMetaViewCategory } from "@/lib/metaPixel";
import { getSizeOptionsForProduct, isProductOutOfStock } from "@/lib/productSizesDisplay";
import { isProductAvailableForPurchase, isProductListedForSale } from "@/lib/productListing";
import { productPathSlug } from "@/lib/productUrl";
import type { Product, StorefrontCategory } from "@/lib/types";

const PLACEHOLDER_IMAGE = "/V7/1.jpg";

type GridProduct = {
  id: number;
  slug: string;
  name: string;
  price: number;
  discountPrice: number | null;
  category: string;
  image: string;
  createdAt: string;
  color: string | null;
  colorHex: string | null;
  color2: string | null;
  color2Hex: string | null;
  sizes: string[];
  stock: number;
  listedForSale: boolean;
};

function toGridProduct(p: Product): GridProduct {
  const image = p.images[0] ?? PLACEHOLDER_IMAGE;
  return {
    id: p.id,
    slug: productPathSlug(p),
    name: p.name,
    price: p.price,
    discountPrice: p.discount_price != null && Number.isFinite(p.discount_price) ? p.discount_price : null,
    category: p.category_name?.trim() || "Autres",
    image,
    createdAt: p.created_at,
    color: p.color?.trim() || null,
    colorHex: /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(p.color_hex ?? "") ? p.color_hex ?? null : null,
    color2: p.color_2?.trim() || null,
    color2Hex: /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(p.color_2_hex ?? "") ? p.color_2_hex ?? null : null,
    sizes: Array.isArray(p.sizes) ? p.sizes.filter((s) => typeof s === "string" && s.trim().length > 0) : [],
    stock: Number(p.stock ?? 0),
    listedForSale: isProductListedForSale(p),
  };
}

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

type WishlistToast = { kind: "added"; name: string; image: string } | { kind: "removed" };

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
      <path
        d="M12 20s-6-3.7-8.3-7C1.6 9.7 3 6 6.4 6c2.1 0 3.2 1.2 3.6 2 .4-.8 1.5-2 3.6-2C17 6 18.4 9.7 16.3 13c-2.3 3.3-8.3 7-8.3 7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TechnicalIssueIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M12 9v3.75m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridDensityIcon({ cols }: { cols: 2 | 4 | 5 }) {
  const w = 22;
  const h = 16;
  const pad = 1.5;
  const gap = 1.5;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const colW = (innerW - gap * (cols - 1)) / cols;
  const rects = Array.from({ length: cols }, (_, i) => {
    const x = pad + i * (colW + gap);
    return <rect key={i} x={x} y={pad} width={colW} height={innerH} rx={0.5} />;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-4 w-[22px]" fill="currentColor" aria-hidden>
      {rects}
    </svg>
  );
}

export default function CollectionView() {
  const [gridCols, setGridCols] = useState<2 | 4 | 5>(5);
  const [sortKey, setSortKey] = useState<SortKey>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [storageV, setStorageV] = useState(0);
  const [products, setProducts] = useState<GridProduct[]>([]);
  const [storefrontCategories, setStorefrontCategories] = useState<StorefrontCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [favoriteFx, setFavoriteFx] = useState<Record<string, boolean>>({});
  const [quickAddProductId, setQuickAddProductId] = useState<number | null>(null);
  const [wishlistToast, setWishlistToast] = useState<WishlistToast | null>(null);
  const wishlistToastTimerRef = useRef<number | null>(null);
  const viewCategoryTrackedRef = useRef("");

  const showWishlistToast = useCallback((t: WishlistToast) => {
    if (wishlistToastTimerRef.current != null) window.clearTimeout(wishlistToastTimerRef.current);
    setWishlistToast(t);
    const ms = t.kind === "added" ? 4000 : 2200;
    wishlistToastTimerRef.current = window.setTimeout(() => {
      setWishlistToast(null);
      wishlistToastTimerRef.current = null;
    }, ms);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setApiErrorMessage(null);
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data: { products?: Product[]; categories?: StorefrontCategory[]; error?: string } = await res.json();
      if (typeof data.error === "string" && data.error.trim()) {
        const msg = data.error.trim();
        setApiErrorMessage(msg);
        if (process.env.NODE_ENV === "development") {
          console.warn("[collection]", msg);
        }
      }
      const list = (data.products ?? []).map(toGridProduct);
      setProducts(list);
      setStorefrontCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch {
      setLoadError(true);
      setProducts([]);
      setStorefrontCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const h = () => setStorageV((v) => v + 1);
    window.addEventListener("vero7-storage", h);
    return () => window.removeEventListener("vero7-storage", h);
  }, []);

  useEffect(() => {
    return () => {
      if (wishlistToastTimerRef.current != null) window.clearTimeout(wishlistToastTimerRef.current);
    };
  }, []);

  const wishlist = useMemo(() => {
    const s = new Set(getWishlistIds());
    return Object.fromEntries(
      products.map((p) => [String(p.id), s.has(p.id)] as [string, boolean])
    ) as Record<string, boolean>;
  }, [storageV, products]);

  const categories = useMemo(() => {
    const fromDb = storefrontCategories.map((c) => c.name);
    if (fromDb.length > 0) {
      return [...fromDb].sort((a, b) => a.localeCompare(b, "fr"));
    }
    return Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b, "fr"));
  }, [storefrontCategories, products]);

  const collectionLoadFailed = loadError || Boolean(apiErrorMessage);

  const gridClass = useMemo(() => {
    if (gridCols === 2) return "grid-cols-2 lg:grid-cols-2";
    if (gridCols === 4) return "grid-cols-2 lg:grid-cols-4";
    return "grid-cols-2 lg:grid-cols-5";
  }, [gridCols]);

  const visibleProducts = useMemo(() => {
    const eff = (p: GridProduct) =>
      p.discountPrice != null && p.discountPrice < p.price ? p.discountPrice : p.price;
    /** Même logique que la page d’accueil : achetable d’abord, puis rupture, puis à venir. */
    const availabilityRank = (p: GridProduct) => {
      if (isProductAvailableForPurchase({ active: p.listedForSale, sizes: p.sizes, stock: p.stock })) return 0;
      if (p.listedForSale) return 1;
      return 2;
    };
    const filtered = products.filter((p) =>
      selectedCategories.length === 0 ? true : selectedCategories.includes(p.category)
    );
    const withIdx = filtered.map((p, idx) => ({ p, idx }));
    withIdx.sort((a, b) => {
      const ra = availabilityRank(a.p);
      const rb = availabilityRank(b.p);
      if (ra !== rb) return ra - rb;
      if (sortKey === "price-asc") {
        const d = eff(a.p) - eff(b.p);
        if (d !== 0) return d;
      } else if (sortKey === "price-desc") {
        const d = eff(b.p) - eff(a.p);
        if (d !== 0) return d;
      } else if (sortKey === "name") {
        const d = a.p.name.localeCompare(b.p.name, "fr");
        if (d !== 0) return d;
      } else {
        const ta = a.p.createdAt;
        const tb = b.p.createdAt;
        if (ta < tb) return 1;
        if (ta > tb) return -1;
      }
      return a.idx - b.idx;
    });
    return withIdx.map(({ p }) => p);
  }, [selectedCategories, sortKey, products]);

  useEffect(() => {
    if (loading) return;
    const categoryName =
      selectedCategories.length === 1
        ? selectedCategories[0]!
        : selectedCategories.length > 1
          ? selectedCategories.join(", ")
          : "Toute la collection";
    if (viewCategoryTrackedRef.current === categoryName) return;
    viewCategoryTrackedRef.current = categoryName;
    trackMetaViewCategory(
      categoryName,
      visibleProducts.slice(0, 50).map((product) => String(product.id)),
    );
  }, [loading, selectedCategories, visibleProducts]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const clearFilters = () => setSelectedCategories([]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1600px] px-5 pb-16 pt-6 sm:px-8 sm:pt-8">
        <div className="flex items-center justify-between gap-3 border-b border-black/15 pb-4">
          <div className="flex items-center gap-4 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em]">
            <button
              type="button"
              onClick={() => {
                setFiltersOpen(true);
                setSortOpen(false);
              }}
              className="inline-flex items-center gap-2 text-black transition hover:opacity-70"
            >
              <MenuIcon className="h-4 w-4 text-zinc-500" />
              Filtres
            </button>
            <button
              type="button"
              onClick={() => {
                setSortOpen((v) => !v);
                setFiltersOpen(false);
              }}
              className="inline-flex items-center gap-2 text-black transition hover:opacity-70"
              aria-expanded={sortOpen}
            >
              <MenuIcon className="h-4 w-4 text-zinc-500" />
              Tri
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2" role="group" aria-label="Densite de la grille">
            {([2, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGridCols(n)}
                aria-pressed={gridCols === n}
                aria-label={`${n} colonnes`}
                className={`rounded-sm p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 ${
                  gridCols === n ? "bg-black text-white" : "text-zinc-400 hover:text-black"
                }`}
              >
                <GridDensityIcon cols={n} />
              </button>
            ))}
          </div>
        </div>

        {sortOpen ? (
          <div className="relative z-20 border-b border-black/10 bg-white py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Trier par</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["featured", "Pertinence"],
                  ["price-asc", "Prix croissant"],
                  ["price-desc", "Prix decroissant"],
                  ["name", "Nom A-Z"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSortKey(key);
                    setSortOpen(false);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    sortKey === key ? "border-black bg-black text-white" : "border-black/15 text-black hover:border-black/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div
            className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-4 py-16 sm:min-h-[calc(100vh-11rem)]"
            role="status"
            aria-live="polite"
            aria-label="Chargement de la collection"
          >
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-black/10 border-t-black"
              aria-hidden
            />
            <p className="text-sm font-medium tracking-wide text-zinc-600">Chargement…</p>
          </div>
        ) : collectionLoadFailed ? (
          <div
            className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center px-6 py-16 text-center sm:min-h-[calc(100vh-12rem)]"
            role="alert"
            aria-live="polite"
          >
            <div className="flex max-w-sm flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <TechnicalIssueIcon className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold uppercase tracking-tight text-black">Problème technique</h2>
              <p className="text-sm leading-relaxed text-zinc-600">
                Nous ne pouvons pas afficher la collection pour le moment. Merci de réessayer dans quelques instants.
              </p>
              <button
                type="button"
                onClick={() => void loadProducts()}
                className="mt-2 rounded-full border border-black bg-black px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-zinc-900"
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-5 text-sm text-zinc-500">
              {visibleProducts.length} article{visibleProducts.length > 1 ? "s" : ""}
            </p>

            {products.length === 0 ? (
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-600">
                Aucun produit pour le moment. Revenez bientôt ou élargissez vos filtres.
              </p>
            ) : null}

            <div className={`mt-6 grid gap-3 sm:gap-4 ${gridClass}`}>
              {visibleProducts.map((product, index) => {
                const list =
                  product.discountPrice != null && product.discountPrice < product.price
                    ? product.price
                    : null;
                const sale =
                  product.discountPrice != null && product.discountPrice < product.price
                    ? product.discountPrice
                    : product.price;
                const discountPercent =
                  list != null && list > 0 ? Math.round(((list - sale) / list) * 100) : null;
                const href = `/collection/${encodeURIComponent(product.slug)}`;
                const quickAddSizes = getSizeOptionsForProduct({ sizes: product.sizes, stock: product.stock });
                const cardOos = isProductOutOfStock({ sizes: product.sizes, stock: product.stock });
                const listedForSale = product.listedForSale;

                const comingSoonPlaceholder = <ComingSoonPlaceholder imageUrl={product.image} />;

                const comingSoonProductCard = comingSoonPlaceholder;

                const productMeta = (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-snug text-black sm:text-[15px]">
                        {product.name}
                      </h2>
                      {discountPercent != null && discountPercent > 0 ? (
                        <span className="ml-auto shrink-0 text-sm font-bold text-red-600">-{discountPercent}%</span>
                      ) : null}
                    </div>
                    <p className="flex items-baseline justify-between gap-2 text-sm text-zinc-500">
                      {list != null ? (
                        <span className="text-zinc-400 line-through">{list.toFixed(2)} DT</span>
                      ) : (
                        <span />
                      )}
                      <span className="ml-auto shrink-0 font-semibold text-black">{sale.toFixed(2)} DT</span>
                    </p>
                    {cardOos ? (
                      <p className="pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                        Rupture de stock
                      </p>
                    ) : null}
                    {product.color || product.color2 ? (
                      <div className="flex items-center gap-1 pt-0.5" aria-hidden>
                        {product.color ? (
                          <span
                            className="inline-block h-4 w-4 shrink-0 rounded-sm border border-black/20"
                            style={
                              product.colorHex
                                ? { backgroundColor: product.colorHex }
                                : { background: "linear-gradient(to bottom right, rgb(244 244 245), rgb(212 212 216))" }
                            }
                            title={product.color}
                          />
                        ) : null}
                        {product.color2 ? (
                          <span
                            className="inline-block h-4 w-4 shrink-0 rounded-sm border border-black/20"
                            style={
                              product.color2Hex
                                ? { backgroundColor: product.color2Hex }
                                : { background: "linear-gradient(to bottom right, rgb(244 244 245), rgb(212 212 216))" }
                            }
                            title={product.color2}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );

                const activeProductCard = (
                  <>
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100">
                      <div className="relative h-full w-full">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          priority={index < 4}
                          loading={index < 4 ? "eager" : "lazy"}
                          fetchPriority={index < 2 ? "high" : "auto"}
                          unoptimized={shouldBypassImageOptimization(product.image)}
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                          className="object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                        />
                      </div>
                      {cardOos ? (
                        <div
                          className="pointer-events-none absolute right-1.5 top-1.5 z-20 sm:right-2 sm:top-2"
                          role="status"
                        >
                          <span className="inline-block whitespace-nowrap rounded-md bg-red-600 px-1.5 py-1 text-center text-[8px] font-bold uppercase leading-tight tracking-wide text-white shadow-md sm:px-2.5 sm:py-1.5 sm:text-[10px] sm:tracking-wider">
                            Rupture de stock
                          </span>
                        </div>
                      ) : null}
                      {!cardOos ? (
                        <>
                          <button
                            type="button"
                            aria-label="Ajouter au panier"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setQuickAddProductId((prev) => (prev === product.id ? null : product.id));
                            }}
                            className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center border border-black/10 bg-white text-lg font-light leading-none text-black shadow-sm transition hover:bg-zinc-50"
                          >
                            +
                          </button>
                          {quickAddProductId === product.id ? (
                            <div
                              className="absolute inset-x-2 bottom-12 z-20 rounded-md border border-black/10 bg-white p-2 shadow-lg"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                                Taille du produit
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {quickAddSizes.map(({ label, available }) => (
                                  <button
                                    key={`${product.id}-${label}`}
                                    type="button"
                                    disabled={!available}
                                    onClick={() => {
                                      if (!available) return;
                                      const fromCard = document.getElementById(`collection-product-${product.id}`);
                                      const imgSrc = product.image || PLACEHOLDER_IMAGE;
                                      addToCart({
                                        productId: product.id,
                                        name: product.name,
                                        price: product.price,
                                        discountPrice: product.discountPrice,
                                        image: imgSrc,
                                        size: label,
                                        color: product.color?.trim() || product.color2?.trim() || undefined,
                                        quantity: 1,
                                      });
                                      dispatchCartAdded();
                                      flyProductThumbnailToCart(fromCard, imgSrc);
                                      setQuickAddProductId(null);
                                    }}
                                    className={
                                      !available
                                        ? "min-w-[2.2rem] cursor-not-allowed border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 line-through decoration-zinc-400"
                                        : "min-w-[2.2rem] border border-black/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black transition hover:border-black/40"
                                    }
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {productMeta}
                  </>
                );

                return (
                  <article
                    id={`collection-product-${product.id}`}
                    key={product.id}
                    className="group relative scroll-mt-28 text-left lg:scroll-mt-36"
                  >
                    {listedForSale ? (
                      <Link href={href} className="block">
                        {activeProductCard}
                      </Link>
                    ) : (
                      <Link href={href} className="group block transition hover:opacity-95">
                        {comingSoonProductCard}
                      </Link>
                    )}
                    {listedForSale && !cardOos ? (
                      <button
                        type="button"
                        aria-label={wishlist[String(product.id)] ? "Retirer des favoris" : "Ajouter aux favoris"}
                        aria-pressed={wishlist[String(product.id)] ?? false}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const isNowFavorite = toggleWishlistId(product.id);
                          if (isNowFavorite) {
                            trackMetaAddToWishlist({
                              id: product.id,
                              name: product.name,
                              price: product.price,
                              discountPrice: product.discountPrice,
                            });
                            setFavoriteFx((prev) => ({ ...prev, [String(product.id)]: true }));
                            window.setTimeout(() => {
                              setFavoriteFx((prev) => ({ ...prev, [String(product.id)]: false }));
                            }, 520);
                            dispatchFavorisAdded();
                            flyProductThumbnailToFavorites(e.currentTarget, product.image);
                            showWishlistToast({ kind: "added", name: product.name, image: product.image });
                          } else {
                            showWishlistToast({ kind: "removed" });
                          }
                        }}
                        className={`absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm transition hover:bg-white ${
                          wishlist[String(product.id)] ? "text-red-600" : "text-black"
                        } ${
                          favoriteFx[String(product.id)] ? "favorite-pop" : ""
                        }`}
                      >
                        <HeartIcon filled={wishlist[String(product.id)]} className="h-4 w-4" />
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>

      {filtersOpen ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            className="h-full flex-1 bg-black/40"
            aria-label="Fermer les filtres"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-black/10 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Filtres</p>
                <h2 className="mt-1 text-lg font-semibold">Categories</h2>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-black/5 hover:text-black"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="mt-6 space-y-3">
              {categories.map((cat) => (
                <li key={cat}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="h-4 w-4 rounded border-black/20 text-black focus:ring-black/30"
                    />
                    <span>{cat}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setFiltersOpen(false);
                }}
                className="flex-1 border border-black/15 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition hover:border-black/40"
              >
                Reinitialiser
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex-1 bg-black py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-zinc-800"
              >
                Voir les resultats
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {wishlistToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fav-toast-bar fav-toast-enter pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-2xl"
        >
          {wishlistToast.kind === "added" ? (
            <>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-zinc-100">
                <Image
                  src={wishlistToast.image}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="44px"
                  unoptimized={shouldBypassImageOptimization(wishlistToast.image)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-black">Ajouté aux favoris</p>
                <p className="truncate text-xs text-zinc-600">{wishlistToast.name}</p>
                <Link
                  href="/favoris"
                  className="mt-0.5 inline-block text-xs font-medium text-zinc-600 underline underline-offset-2 transition hover:text-black"
                >
                  Voir mes favoris
                </Link>
              </div>
            </>
          ) : (
            <p className="pr-1 text-sm font-medium text-black">Retiré de vos favoris</p>
          )}
        </div>
      ) : null}
    </div>
  );
}


