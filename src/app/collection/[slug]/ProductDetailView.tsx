"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { productPathSlug } from "@/lib/productUrl";
import {
  dispatchCartAdded,
  dispatchFavorisAdded,
  flyProductThumbnailToCart,
  flyProductThumbnailToFavorites,
} from "@/lib/favorisUx";
import { addToCart, getWishlistIds, toggleWishlistId } from "@/lib/shopClientStorage";
import { getSizeOptionsForProduct, isProductOutOfStock } from "@/lib/productSizesDisplay";
import type { Product } from "@/lib/types";

const PLACEHOLDER = "/V7/1.jpg";

function HeartIcon({ filled, className }: { filled?: boolean; className?: string }) {
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

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

type Swatch = { label: string; hex: string | null };

/**
 * − / quantité / + (fond blanc, bordures légères). Désactivé si rupture ou max stock atteint.
 */
function QuantityStepper({
  value,
  onChange,
  min,
  max,
  disabled,
  compact,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  disabled: boolean;
  /** Hauteur légèrement réduite pour la feuille mobile */
  compact?: boolean;
}) {
  const h = compact ? "h-9" : "h-10";
  const w = compact ? "w-9" : "w-10";
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <div
      className={`inline-flex max-w-full border border-zinc-300 bg-white ${disabled ? "opacity-50" : ""}`}
      role="group"
      aria-label="Quantité"
    >
      <button
        type="button"
        disabled={disabled || atMin}
        aria-label="Diminuer la quantité"
        onClick={() => onChange(value - 1)}
        className={`flex ${h} ${w} shrink-0 items-center justify-center border-r border-zinc-300 bg-white text-base font-light text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        −
      </button>
      <div
        className={`flex ${h} min-w-[2.75rem] grow items-center justify-center border-r border-zinc-300 bg-white text-sm font-medium tabular-nums text-zinc-900 sm:min-w-[3rem]`}
        aria-live="polite"
      >
        {value}
      </div>
      <button
        type="button"
        disabled={disabled || atMax}
        aria-label="Augmenter la quantité"
        onClick={() => onChange(value + 1)}
        className={`flex ${h} ${w} shrink-0 items-center justify-center bg-white text-base font-light text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}

/**
 * Même produit, design pouvant combiner 2+ couleurs (ex. rayures) : pastilles
 * informatives, pas de choix de variante.
 */
function ProductDesignColors({
  swatches,
  namePrefix,
  className = "mt-2",
}: {
  swatches: Swatch[];
  namePrefix: string;
  className?: string;
}) {
  if (swatches.length === 0) return null;
  return (
    <ul
      className={`flex flex-wrap items-end gap-4 sm:gap-5 ${className} relative z-20`}
      aria-label="Couleurs du modèle (design)"
    >
      {swatches.map((c, i) => (
        <li key={`${namePrefix}-design-${c.label}-${i}`} className="flex list-none flex-col items-center gap-1.5">
          <div
            className="h-10 w-10 shrink-0 rounded-sm border border-zinc-300"
            style={
              c.hex
                ? { backgroundColor: c.hex }
                : { background: "linear-gradient(to bottom right, rgb(244 244 245), rgb(212 212 216))" }
            }
            aria-hidden
            title={c.label}
          />
          <span className="max-w-[5rem] text-center text-[11px] font-medium leading-tight text-zinc-700">
            {c.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Props = { product: Product };

export default function ProductDetailView({ product }: Props) {
  const images = useMemo(
    () => (product.images.length > 0 ? product.images : [PLACEHOLDER]),
    [product.images]
  );
  const [active, setActive] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [fav, setFav] = useState(false);
  const [favFx, setFavFx] = useState(false);
  const [favToast, setFavToast] = useState<"added" | "removed" | null>(null);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [quickAddProductId, setQuickAddProductId] = useState<number | null>(null);
  const [showMobileStickyCart, setShowMobileStickyCart] = useState(false);
  const [mobileQuickAddOpen, setMobileQuickAddOpen] = useState(false);
  const [mobileQuickSize, setMobileQuickSize] = useState<string | null>(null);
  const [addQty, setAddQty] = useState(1);
  const favBtnRef = useRef<HTMLButtonElement>(null);
  const mainAddBtnRef = useRef<HTMLButtonElement>(null);
  const sizeSectionRef = useRef<HTMLDivElement>(null);
  const favToastTimerRef = useRef<number | null>(null);

  const sizeOptions = useMemo(() => getSizeOptionsForProduct(product), [product]);
  const outOfStock = !sizeOptions.some((o) => o.available);

  const displayPrice =
    product.discount_price != null && product.discount_price < product.price
      ? product.discount_price
      : product.price;
  const compareAt =
    product.discount_price != null && product.discount_price < product.price ? product.price : null;
  const discountPercent =
    compareAt != null && compareAt > 0
      ? Math.max(1, Math.round(((compareAt - displayPrice) / compareAt) * 100))
      : null;

  const stockQty = Math.max(0, Math.floor(Number(product.stock ?? 0)));

  const colorHex = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(product.color_hex ?? "") ? product.color_hex : null;
  const colorHex2 = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(product.color_2_hex ?? "")
    ? product.color_2_hex
    : null;

  const colorChoices = useMemo(() => {
    const out: Swatch[] = [];
    const seen = new Set<string>();
    const push = (raw: string | null | undefined, hex: string | null) => {
      const t = raw?.trim();
      if (!t) return;
      const key = t.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label: t, hex });
    };
    push(product.color, colorHex ?? null);
    push(product.color_2, colorHex2 ?? null);
    return out;
  }, [product.color, product.color_2, colorHex, colorHex2]);

  useEffect(() => {
    setActive(0);
    setAddQty(1);
    setSelectedSize(null);
  }, [product.id]);

  useEffect(() => {
    if (outOfStock) return;
    if (stockQty < 1) return;
    setAddQty((q) => {
      if (q < 1) return 1;
      if (q > stockQty) return stockQty;
      return q;
    });
  }, [outOfStock, stockQty, product.id]);

  /** Un seul article : libellé panier = 1 couleur, ou toutes les teintes du design reliées (ex. « Noir & Blanc »). */
  const colorForCart = useMemo((): string | undefined => {
    if (colorChoices.length === 0) return product.color?.trim() || undefined;
    if (colorChoices.length === 1) return colorChoices[0]!.label;
    return colorChoices.map((c) => c.label).join(" & ");
  }, [colorChoices, product.color]);

  const hasPickedSize = useMemo(() => {
    if (selectedSize == null || selectedSize === "") return false;
    return sizeOptions.some((o) => o.label === selectedSize && o.available);
  }, [selectedSize, sizeOptions]);

  const syncFav = useCallback(() => {
    setFav(getWishlistIds().includes(product.id));
  }, [product.id]);

  useEffect(() => {
    syncFav();
    const on = () => syncFav();
    window.addEventListener("vero7-storage", on);
    return () => window.removeEventListener("vero7-storage", on);
  }, [syncFav]);

  useEffect(() => {
    return () => {
      if (favToastTimerRef.current != null) window.clearTimeout(favToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sizeGuideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSizeGuideOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sizeGuideOpen]);

  useEffect(() => {
    if (!mobileQuickAddOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileQuickAddOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileQuickAddOpen]);

  useEffect(() => {
    const onResizeOrScroll = () => {
      if (typeof window === "undefined") return;
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      if (!isMobile) {
        setShowMobileStickyCart(false);
        return;
      }
      const el = sizeSectionRef.current;
      if (!el) {
        setShowMobileStickyCart(false);
        return;
      }
      const r = el.getBoundingClientRect();
      const inView = r.top < window.innerHeight * 0.85 && r.bottom > 0;
      setShowMobileStickyCart(!inView && !outOfStock);
    };

    onResizeOrScroll();
    window.addEventListener("scroll", onResizeOrScroll, { passive: true });
    window.addEventListener("resize", onResizeOrScroll);
    return () => {
      window.removeEventListener("scroll", onResizeOrScroll);
      window.removeEventListener("resize", onResizeOrScroll);
    };
  }, [outOfStock]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ products?: Product[] }>)
      .then((d) => {
        if (cancelled) return;
        const all = Array.isArray(d.products) ? d.products : [];
        const ranked = all
          .filter((p) => p.id !== product.id)
          .sort((a, b) => {
            const aSame = a.category_id != null && a.category_id === product.category_id ? 1 : 0;
            const bSame = b.category_id != null && b.category_id === product.category_id ? 1 : 0;
            return bSame - aSame;
          })
          .slice(0, 4);
        setSuggestions(ranked);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, product.category_id]);

  const scheduleFavToast = useCallback((kind: "added" | "removed") => {
    if (favToastTimerRef.current != null) window.clearTimeout(favToastTimerRef.current);
    setFavToast(kind);
    const ms = kind === "added" ? 4200 : 2400;
    favToastTimerRef.current = window.setTimeout(() => {
      setFavToast(null);
      favToastTimerRef.current = null;
    }, ms);
  }, []);

  const onToggleFav = () => {
    const isNowFavorite = toggleWishlistId(product.id);
    syncFav();
    if (isNowFavorite) {
      setFavFx(true);
      window.setTimeout(() => setFavFx(false), 520);
      dispatchFavorisAdded();
      const thumbSrc = images[Math.min(active, images.length - 1)] ?? PLACEHOLDER;
      flyProductThumbnailToFavorites(favBtnRef.current, thumbSrc);
      scheduleFavToast("added");
    } else {
      scheduleFavToast("removed");
    }
  };

  const categoryLabel = product.category_name?.trim() || "Vetements";
  const titleUpper = product.name.toUpperCase();

  const mainSrc = images[Math.min(active, images.length - 1)] ?? PLACEHOLDER;
  const isRemote = (u: string) => u.startsWith("http");
  const hasMultipleImages = images.length > 1;
  const showPrevImage = () => setActive((prev) => (prev - 1 + images.length) % images.length);
  const showNextImage = () => setActive((prev) => (prev + 1) % images.length);
  const resolveAddToCartSize = useCallback((): string | null => {
    if (selectedSize == null || selectedSize === "") return null;
    const o = sizeOptions.find((x) => x.label === selectedSize);
    return o?.available ? selectedSize : null;
  }, [selectedSize, sizeOptions]);

  const addToCartWithFeedback = (originEl: HTMLElement | null, size: string) => {
    const q = Math.min(Math.max(1, addQty), stockQty);
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      discountPrice: product.discount_price,
      image: product.images[0],
      size,
      color: colorForCart,
      quantity: q,
    });
    dispatchCartAdded();
    flyProductThumbnailToCart(originEl, product.images[0] ?? mainSrc);
    setAddQty(1);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1400px] px-0 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,26rem)] lg:gap-14 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,28rem)] xl:gap-16">
          {/* Galerie */}
          <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
            <div className="order-2 hidden flex-row gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex lg:w-[4.75rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0 lg:pr-0 lg:pt-1">
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Image ${i + 1}`}
                  aria-current={active === i ? "true" : undefined}
                  className={`relative h-[4.5rem] w-[3.25rem] shrink-0 overflow-hidden bg-zinc-100 ring-2 ring-offset-1 ring-offset-zinc-100 transition sm:h-24 sm:w-[4.5rem] lg:h-20 lg:w-full ${
                    active === i ? "ring-black" : "ring-transparent hover:ring-black/20"
                  }`}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="80px"
                    loading={i === 0 ? "eager" : "lazy"}
                    priority={i === 0}
                    unoptimized={isRemote(src)}
                    className="object-cover object-center"
                  />
                </button>
              ))}
            </div>
            <div className="relative order-1 aspect-[3/4] w-full min-h-[280px] overflow-hidden bg-zinc-100 sm:min-h-[360px] lg:order-2 lg:min-h-[420px]">
                <Image
                  src={mainSrc}
                  alt={product.name}
                  fill
                  priority
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  unoptimized={isRemote(mainSrc)}
                  className="object-contain object-center"
                />
              {outOfStock ? (
                <div
                  className="pointer-events-none absolute right-2 top-2 z-30 sm:right-3 sm:top-3"
                  role="status"
                >
                  <span className="inline-block whitespace-nowrap rounded-md bg-red-600 px-2.5 py-1.5 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white shadow-md sm:px-3 sm:text-xs sm:tracking-wider">
                    Rupture de stock
                  </span>
                </div>
              ) : null}
              {hasMultipleImages ? (
                <div className="absolute left-2 top-2 z-20 flex items-center gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={showPrevImage}
                    aria-label="Image précédente"
                    className="flex h-8 w-8 items-center justify-center border border-black/10 bg-white/95 text-black shadow-sm transition hover:bg-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    aria-label="Image suivante"
                    className="flex h-8 w-8 items-center justify-center border border-black/10 bg-white/95 text-black shadow-sm transition hover:bg-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ) : null}
              {!outOfStock ? (
                <button
                  ref={favBtnRef}
                  type="button"
                  aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
                  aria-pressed={fav}
                  onClick={onToggleFav}
                  className={`absolute right-2 top-2 z-20 rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm transition hover:bg-white ${
                    fav ? "text-red-600" : "text-black"
                  } ${favFx ? "favorite-pop" : ""}`}
                >
                  <HeartIcon filled={fav} className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Infos */}
          <div className="flex flex-col px-4 sm:px-0 lg:pt-2">
            <nav className="text-[11px] leading-relaxed text-zinc-500 sm:text-xs" aria-label="Fil d'Ariane">
              <Link href="/" className="transition hover:text-black">
                Accueil
              </Link>
              <span className="mx-1.5 text-zinc-300">/</span>
              <Link href="/collection" className="transition hover:text-black">
                Collection
              </Link>
              <span className="mx-1.5 text-zinc-300">/</span>
              <span className="text-zinc-600">{categoryLabel}</span>
              <span className="mx-1.5 text-zinc-300">/</span>
              <span className="text-black">{product.name}</span>
            </nav>

            <div className="mt-6 flex items-start justify-between gap-4 border-b border-black/10 pb-6">
              <h1 className="max-w-[90%] text-xl font-semibold uppercase leading-[1.2] tracking-tight sm:text-2xl lg:text-[1.65rem] lg:leading-tight">
                {titleUpper}
              </h1>
              {discountPercent != null ? (
                <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  Solde -{discountPercent}%
                </span>
              ) : (
                <span />
              )}
            </div>

            <div className="mt-6 flex items-baseline justify-between gap-3 text-lg tabular-nums sm:text-xl">
              <span className="font-semibold text-black">{formatPrice(displayPrice)}</span>
              {compareAt != null ? (
                <span className="text-base font-normal text-zinc-400 line-through">
                  {formatPrice(compareAt)}
                </span>
              ) : (
                <span />
              )}
            </div>

            <div className="mt-10">
              <div
                className={
                  outOfStock
                    ? "space-y-2"
                    : "flex items-end justify-between gap-4"
                }
              >
                <div className="relative z-20 min-w-0 flex-1">
                  <p className="text-sm font-semibold text-black">
                    {colorChoices.length > 1 ? (
                      <>
                        {colorChoices.length === 2 ? "Design bicolore : " : "Design (plusieurs couleurs) : "}
                        <span className="font-medium text-zinc-700">
                          {colorChoices.map((c) => c.label).join(" · ")}
                        </span>
                      </>
                    ) : (
                      <>
                        Couleur :{" "}
                        <span className="font-medium text-zinc-700">
                          {colorChoices[0]?.label || product.color?.trim() || "—"}
                        </span>
                      </>
                    )}
                  </p>
                  {colorChoices.length > 0 ? (
                    <ProductDesignColors swatches={colorChoices} namePrefix="product-detail" className="mt-2" />
                  ) : (
                    <span
                      className="mt-2 inline-block h-10 w-10 rounded-sm border border-zinc-300"
                      style={{ background: "linear-gradient(to bottom right, rgb(244 244 245), rgb(212 212 216))" }}
                      aria-hidden
                    />
                  )}
                </div>
                {!outOfStock ? (
                  <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
                    <p className="text-sm font-semibold text-black">Quantité</p>
                    <QuantityStepper
                      value={addQty}
                      onChange={setAddQty}
                      min={1}
                      max={Math.max(1, stockQty)}
                      disabled={stockQty < 1}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div ref={sizeSectionRef} className="mt-10">
              {outOfStock ? (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                    {sizeOptions.map(({ label }) => (
                      <button
                        key={label}
                        type="button"
                        disabled
                        aria-disabled
                        className="w-full cursor-not-allowed border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 line-through decoration-zinc-400 [text-decoration-thickness:1px] sm:w-auto sm:min-w-[2.75rem] sm:py-2 sm:text-sm"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm font-medium text-red-600" role="status">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden />
                    Rupture de stock — commande impossible
                  </p>
                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-700">Taille :</p>
                    {product.size_guide_image ? (
                      <button
                        type="button"
                        onClick={() => setSizeGuideOpen(true)}
                        className="text-xs font-semibold uppercase tracking-wider text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                      >
                        Guide des tailles
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-black">Taille</p>
                    {product.size_guide_image ? (
                      <button
                        type="button"
                        onClick={() => setSizeGuideOpen(true)}
                        className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                      >
                        Guide des tailles
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                    {sizeOptions.map(({ label, available }) => {
                      const selected = selectedSize === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          disabled={!available}
                          onClick={() => available && setSelectedSize(label)}
                          aria-pressed={selected && available}
                          aria-disabled={!available}
                          className={
                            !available
                              ? "w-full cursor-not-allowed border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 line-through decoration-zinc-400 sm:w-auto sm:min-w-[2.75rem] sm:text-sm"
                              : selected
                                ? "w-full border border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition sm:w-auto sm:min-w-[2.75rem] sm:text-sm"
                                : "w-full border border-black/15 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:border-black/40 sm:w-auto sm:min-w-[2.75rem] sm:text-sm"
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-xs text-zinc-500">Le mannequin mesure 187 cm et porte du M.</p>
                  {!hasPickedSize ? (
                    <p className="mt-2 text-xs font-medium text-zinc-600" role="status">
                      Choisissez une taille pour continuer.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {outOfStock ? (
              <button
                type="button"
                disabled
                className="mt-10 w-full cursor-not-allowed border-0 bg-zinc-400 py-3.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-white"
              >
                RUPTURE DE STOCK
              </button>
            ) : (
              <button
                ref={mainAddBtnRef}
                type="button"
                disabled={!hasPickedSize}
                onClick={() => {
                  const size = resolveAddToCartSize();
                  if (!size) return;
                  addToCartWithFeedback(mainAddBtnRef.current, size);
                }}
                className="mt-10 w-full border border-black bg-black py-3.5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                Ajouter au panier
              </button>
            )}

            {product.description?.trim() ? (
              <div className="mt-10 border-t border-black/10 pt-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Description</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{product.description}</p>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {suggestions.length > 0 ? (
        <section className="mx-auto w-full max-w-[1600px] px-4 pb-16 sm:px-6 lg:px-10">
          <h2 className="text-3xl font-black uppercase tracking-tight text-black">VOUS AIMEREZ AUSSI</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {suggestions.map((p, idx) => {
              const src = p.images[0] ?? PLACEHOLDER;
              const list = p.discount_price != null && p.discount_price < p.price ? p.price : null;
              const sale = p.discount_price != null && p.discount_price < p.price ? p.discount_price : p.price;
              const discountPercent =
                list != null && list > 0 ? Math.round(((list - sale) / list) * 100) : null;
              const isSuggestedFav = getWishlistIds().includes(p.id);
              const suggestedSizeOpts = getSizeOptionsForProduct(p);
              const suggestedOos = isProductOutOfStock(p);
              return (
                <article key={p.id} className="group text-left">
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100">
                    <Link
                      href={`/collection/${encodeURIComponent(productPathSlug(p))}`}
                      className="relative block h-full w-full"
                    >
                      <Image
                        src={src}
                        alt={p.name}
                        fill
                        priority={idx < 2}
                        loading={idx < 2 ? "eager" : "lazy"}
                        fetchPriority={idx < 2 ? "high" : "auto"}
                        unoptimized={isRemote(src)}
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                      />
                    </Link>
                    <button
                      type="button"
                      aria-label={isSuggestedFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                      aria-pressed={isSuggestedFav}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const isNowFavorite = toggleWishlistId(p.id);
                        if (isNowFavorite) {
                          dispatchFavorisAdded();
                          flyProductThumbnailToFavorites(e.currentTarget, src);
                        }
                        syncFav();
                      }}
                      className={`absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm transition hover:bg-white ${
                        isSuggestedFav ? "text-red-600" : "text-black"
                      }`}
                    >
                      <HeartIcon filled={isSuggestedFav} className="h-4 w-4" />
                    </button>
                    {!suggestedOos ? (
                      <>
                    <button
                      type="button"
                      aria-label="Ajouter au panier"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuickAddProductId((prev) => (prev === p.id ? null : p.id));
                      }}
                      className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center border border-black/10 bg-white text-lg font-light leading-none text-black shadow-sm transition hover:bg-zinc-50"
                    >
                      +
                    </button>
                    {quickAddProductId === p.id ? (
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
                          {suggestedSizeOpts.map(({ label, available }) => (
                            <button
                              key={`${p.id}-${label}`}
                              type="button"
                              disabled={!available}
                              onClick={() => {
                                if (!available) return;
                                addToCart({
                                  productId: p.id,
                                  name: p.name,
                                  price: p.price,
                                  discountPrice: p.discount_price,
                                  image: p.images[0],
                                  size: label,
                                  color: p.color ?? undefined,
                                  quantity: 1,
                                });
                                dispatchCartAdded();
                                flyProductThumbnailToCart(sizeSectionRef.current, p.images[0] ?? PLACEHOLDER);
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
                  <Link href={`/collection/${encodeURIComponent(productPathSlug(p))}`} className="block">
                    <div className="mt-3 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-snug text-black sm:text-[15px]">
                          {p.name}
                        </h3>
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
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {showMobileStickyCart ? (
        <div className="fixed inset-x-4 bottom-4 z-[110] sm:hidden">
          <button
            type="button"
            onClick={() => {
              setMobileQuickSize(
                selectedSize && sizeOptions.some((o) => o.label === selectedSize && o.available)
                  ? selectedSize
                  : null
              );
              setMobileQuickAddOpen(true);
            }}
            className="flex w-full items-center justify-between bg-[#1a2b74] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white shadow-2xl"
          >
            <span>ADD TO CART</span>
            <span>{displayPrice.toFixed(2)} DT</span>
          </button>
        </div>
      ) : null}

      {mobileQuickAddOpen && !outOfStock ? (
        <div className="fixed inset-0 z-[130] sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer"
            onClick={() => setMobileQuickAddOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-xl font-black uppercase leading-tight text-black">{titleUpper}</h3>
              <button
                type="button"
                onClick={() => setMobileQuickAddOpen(false)}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="text-lg font-semibold text-black">{formatPrice(displayPrice)}</p>

            <div
              className="mt-5 flex items-end justify-between gap-4"
            >
              <div className="relative z-20 min-w-0 flex-1">
                <p className="text-sm font-semibold text-black">
                  {colorChoices.length > 1 ? (
                    <>
                      {colorChoices.length === 2 ? "Design bicolore : " : "Design (plusieurs couleurs) : "}
                      <span className="font-medium text-zinc-700">
                        {colorChoices.map((c) => c.label).join(" · ")}
                      </span>
                    </>
                  ) : (
                    <>
                      Couleur :{" "}
                      <span className="font-medium text-zinc-700">
                        {colorChoices[0]?.label || product.color?.trim() || "—"}
                      </span>
                    </>
                  )}
                </p>
                {colorChoices.length > 0 ? (
                  <ProductDesignColors swatches={colorChoices} namePrefix="mobile-quick" className="mt-2" />
                ) : null}
              </div>
              <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
                <p className="text-sm font-semibold text-black">Quantité</p>
                <QuantityStepper
                  value={addQty}
                  onChange={setAddQty}
                  min={1}
                  max={Math.max(1, stockQty)}
                  disabled={stockQty < 1}
                  compact
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-black">Taille</p>
                {product.size_guide_image ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileQuickAddOpen(false);
                      setSizeGuideOpen(true);
                    }}
                    className="text-sm font-medium text-zinc-400"
                  >
                    Size guide
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {sizeOptions.map(({ label, available }) => {
                  const picked = mobileQuickSize === label;
                  return (
                    <button
                      key={`mobile-quick-${label}`}
                      type="button"
                      disabled={!available}
                      onClick={() => available && setMobileQuickSize(label)}
                      aria-pressed={picked && available}
                      className={
                        !available
                          ? "w-full cursor-not-allowed border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 line-through decoration-zinc-400"
                          : picked
                            ? "w-full border border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                            : "w-full border border-black/15 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:border-black/40"
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={
                !mobileQuickSize ||
                !sizeOptions.find((o) => o.label === mobileQuickSize && o.available)
              }
              onClick={() => {
                if (!mobileQuickSize) return;
                if (!sizeOptions.find((o) => o.label === mobileQuickSize && o.available)) return;
                const q = Math.min(Math.max(1, addQty), stockQty);
                addToCart({
                  productId: product.id,
                  name: product.name,
                  price: product.price,
                  discountPrice: product.discount_price,
                  image: product.images[0],
                  size: mobileQuickSize,
                  color: colorForCart,
                  quantity: q,
                });
                dispatchCartAdded();
                flyProductThumbnailToCart(sizeSectionRef.current, product.images[0] ?? mainSrc);
                setSelectedSize(mobileQuickSize);
                setAddQty(1);
                setMobileQuickAddOpen(false);
              }}
              className="mt-4 w-full border border-black bg-black py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              Ajouter au panier
            </button>
          </div>
        </div>
      ) : null}

      <SiteFooter />

      {sizeGuideOpen && product.size_guide_image ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 sm:p-8"
          role="presentation"
          onClick={() => setSizeGuideOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            role="dialog"
            aria-label="Guide des tailles"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
              <p className="text-sm font-semibold">Guide des tailles</p>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="relative min-h-[200px] flex-1 overflow-y-auto bg-zinc-50 p-4">
              <div className="relative mx-auto max-w-full">
                <Image
                  src={product.size_guide_image}
                  alt="Guide des tailles"
                  width={1200}
                  height={1600}
                  className="h-auto w-full object-contain"
                  unoptimized={isRemote(product.size_guide_image)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {favToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fav-toast-bar fav-toast-enter pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-2xl"
        >
          {favToast === "added" ? (
            <>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-zinc-100">
                <Image
                  src={mainSrc}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="44px"
                  unoptimized={isRemote(mainSrc)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-black">Ajouté aux favoris</p>
                <Link
                  href="/favoris"
                  className="text-xs font-medium text-zinc-600 underline underline-offset-2 transition hover:text-black"
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

