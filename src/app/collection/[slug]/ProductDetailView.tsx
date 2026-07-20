"use client";

import Image from "next/image";
import Link from "next/link";
import { ZoomIn } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ProductImageLightbox } from "@/components/ProductImageLightbox";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { shouldBypassImageOptimization } from "@/lib/imageOptimize";
import { PRODUCT_GALLERY_SIZES, preloadProductGalleryImage, preloadProductGalleryImages } from "@/lib/productGallery";
import { requestSplashTransition, SPLASH_DONE_EVENT } from "@/lib/splashTransition";
import { productPathSlug } from "@/lib/productUrl";
import {
  dispatchCartAdded,
  dispatchFavorisAdded,
  flyProductThumbnailToCart,
  flyProductThumbnailToFavorites,
} from "@/lib/favorisUx";
import { addToCart, getWishlistIds, toggleWishlistId } from "@/lib/shopClientStorage";
import { trackMetaViewContent, trackMetaAddToWishlist } from "@/lib/metaPixel";
import { getSizeOptionsForProduct, isProductOutOfStock } from "@/lib/productSizesDisplay";
import { isProductListedForSale } from "@/lib/productListing";
import type { Product } from "@/lib/types";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

const PLACEHOLDER = "/V7/1.webp";

/** Petit cadre de zoom desktop — a droite du curseur (style infobulle). */
const MAG_LENS_W = 118;
const MAG_LENS_H = 148;
const MAG_LENS_PAD = 10;
/** Espace entre le curseur et le bord gauche du cadre. */
const MAG_CURSOR_GAP = 20;
/** Inertie du cadre (0–1, plus haut = suit plus vite). */
const MAG_LERP = 0.18;

type HoverMagState = {
  nx: number;
  ny: number;
  left: number;
  top: number;
};

function hoverMagFromPointer(px: number, py: number, cw: number, ch: number): HoverMagState {
  // Par defaut : cadre a droite du curseur, centre verticalement (le curseur reste visible).
  let left = px + MAG_CURSOR_GAP;
  let top = py - MAG_LENS_H / 2;

  if (left + MAG_LENS_W > cw - MAG_LENS_PAD) {
    left = px - MAG_LENS_W - MAG_CURSOR_GAP;
  }

  left = Math.max(MAG_LENS_PAD, Math.min(left, cw - MAG_LENS_W - MAG_LENS_PAD));
  top = Math.max(MAG_LENS_PAD, Math.min(top, ch - MAG_LENS_H - MAG_LENS_PAD));

  return {
    nx: Math.min(1, Math.max(0, px / cw)),
    ny: Math.min(1, Math.max(0, py / ch)),
    left,
    top,
  };
}

function lerpHoverMag(current: HoverMagState, target: HoverMagState): HoverMagState {
  const t = MAG_LERP;
  return {
    nx: current.nx + (target.nx - current.nx) * t,
    ny: current.ny + (target.ny - current.ny) * t,
    left: current.left + (target.left - current.left) * t,
    top: current.top + (target.top - current.top) * t,
  };
}

function hoverMagNear(a: HoverMagState, b: HoverMagState) {
  return (
    Math.abs(a.left - b.left) < 0.6 &&
    Math.abs(a.top - b.top) < 0.6 &&
    Math.abs(a.nx - b.nx) < 0.0015 &&
    Math.abs(a.ny - b.ny) < 0.0015
  );
}

type AudioTheme = "red" | "yellow";
type AudioTrack = { src: string; title: string; theme: AudioTheme };

/**
 * Bandes-son auto-declenchees quand certains mots-cles apparaissent dans le
 * nom (ou le slug) du produit. La detection est tolerante (accents, casse,
 * tirets / espaces) pour fonctionner quelle que soit la forme exacte du slug.
 */
const PRODUCT_AUDIO_RULES: { keywords: string[]; track: AudioTrack }[] = [
  {
    keywords: ["club africain"],
    track: { src: "/CA.mp3", title: "Music du Club Africain", theme: "red" },
  },
  {
    keywords: ["1920 champions"],
    track: { src: "/CA.mp3", title: "Music du Club Africain", theme: "red" },
  },
  {
    keywords: ["esperance"],
    track: { src: "/EST.mp3", title: "Music de l'Esperance Sportive", theme: "yellow" },
  },
  {
    keywords: ["taraji"],
    track: { src: "/EST.mp3", title: "Music de l'Esperance Sportive", theme: "yellow" },
  },
];

function normalizeForMatch(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveAudioTrack(product: { name?: string | null; slug?: string | null }): AudioTrack | null {
  const haystack = `${normalizeForMatch(product.name)} ${normalizeForMatch(product.slug)}`.trim();
  if (!haystack) return null;
  for (const rule of PRODUCT_AUDIO_RULES) {
    if (rule.keywords.every((kw) => haystack.includes(normalizeForMatch(kw)))) {
      return rule.track;
    }
  }
  return null;
}

function ListingLockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="4" y="10" width="16" height="11" rx="1.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

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
  mini,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  disabled: boolean;
  /** Hauteur légèrement réduite pour la feuille mobile */
  compact?: boolean;
  /** Très compact pour la barre sticky */
  mini?: boolean;
}) {
  const { t } = useTranslations();
  const h = mini ? "h-6" : compact ? "h-8" : "h-10";
  const w = mini ? "w-6" : compact ? "w-8" : "w-10";
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <div
      className={`inline-flex max-w-full overflow-hidden rounded-full border border-zinc-300 bg-white ${disabled ? "opacity-50" : ""}`}
      role="group"
      aria-label={t("common.quantity")}
    >
      <button
        type="button"
        disabled={disabled || atMin}
        aria-label={t("common.decreaseQty")}
        onClick={() => onChange(value - 1)}
        className={`flex ${h} ${w} shrink-0 items-center justify-center border-r border-zinc-300 bg-white font-light text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 ${mini ? "text-xs" : "text-sm"}`}
      >
        −
      </button>
      <div
        className={`flex ${h} grow items-center justify-center border-r border-zinc-300 bg-white font-medium tabular-nums text-zinc-900 ${
          mini ? "min-w-[1.35rem] text-[10px]" : compact ? "min-w-[2rem] text-xs" : "min-w-[2.75rem] text-sm sm:min-w-[3rem]"
        }`}
        aria-live="polite"
      >
        {value}
      </div>
      <button
        type="button"
        disabled={disabled || atMax}
        aria-label={t("common.increaseQty")}
        onClick={() => onChange(value + 1)}
        className={`flex ${h} ${w} shrink-0 items-center justify-center bg-white font-light text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 ${mini ? "text-xs" : "text-sm"}`}
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
  const { t } = useTranslations();
  if (swatches.length === 0) return null;
  return (
    <ul
      className={`flex flex-wrap items-end gap-4 sm:gap-5 ${className} relative z-20`}
      aria-label={t("product.designColors")}
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
  const { t, formatMoney } = useTranslations();
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
  const [showStickyCart, setShowStickyCart] = useState(false);
  const [openInfoPanel, setOpenInfoPanel] = useState<"description" | "shipping" | null>("description");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSize, setQuickAddSize] = useState<string | null>(null);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  /** Index affiche dans la lightbox (aligne sur l'image principale au clic). */
  const [lightboxIndex, setLightboxIndex] = useState(0);
  /** Position affichee du cadre de zoom (interpolation fluide). */
  const [hoverMag, setHoverMag] = useState<HoverMagState | null>(null);
  const magTargetRef = useRef<HoverMagState | null>(null);
  const magRafRef = useRef<number | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  /** After V7 splash + fonts: show header, gallery and infos in one block (no image-first flash). */
  const [pageRevealed, setPageRevealed] = useState(false);
  const favBtnRef = useRef<HTMLButtonElement>(null);
  const mainAddBtnRef = useRef<HTMLButtonElement>(null);
  const sizeSectionRef = useRef<HTMLDivElement>(null);
  const stickyTriggerRef = useRef<HTMLDivElement>(null);
  const favToastTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;

    const reveal = () => {
      if (cancelled) return;
      void (async () => {
        try {
          await document.fonts?.ready;
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            if (!cancelled) setPageRevealed(true);
          });
        });
      })();
    };

    const onSplashDone = () => reveal();

    if (!document.documentElement.classList.contains("vero7-splash-active")) {
      reveal();
    } else {
      window.addEventListener(SPLASH_DONE_EVENT, onSplashDone, { once: true });
    }

    const fallback = window.setTimeout(reveal, 4500);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      window.removeEventListener(SPLASH_DONE_EVENT, onSplashDone);
    };
  }, []);

  const stopMagLoop = useCallback(() => {
    if (magRafRef.current != null) {
      cancelAnimationFrame(magRafRef.current);
      magRafRef.current = null;
    }
  }, []);

  const runMagLoop = useCallback(() => {
    const tick = () => {
      const target = magTargetRef.current;
      if (!target) {
        setHoverMag(null);
        magRafRef.current = null;
        return;
      }
      setHoverMag((prev) => {
        if (!prev) return target;
        if (hoverMagNear(prev, target)) return target;
        return lerpHoverMag(prev, target);
      });
      magRafRef.current = requestAnimationFrame(tick);
    };
    if (magRafRef.current == null) {
      magRafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const audioTrack = useMemo(
    () => resolveAudioTrack({ name: product.name, slug: product.slug ?? null }),
    [product.name, product.slug]
  );

  const sizeOptions = useMemo(() => getSizeOptionsForProduct(product), [product]);
  const outOfStock = !sizeOptions.some((o) => o.available);
  const inactiveListing = !isProductListedForSale(product);

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
    setImageZoomOpen(false);
    setLightboxIndex(0);
    magTargetRef.current = null;
    stopMagLoop();
    setHoverMag(null);
  }, [product.id, stopMagLoop]);

  useEffect(() => {
    trackMetaViewContent(product);
  }, [product]);

  useEffect(() => () => stopMagLoop(), [stopMagLoop]);

  useEffect(() => {
    preloadProductGalleryImages(images);
  }, [images]);

  useEffect(() => {
    preloadProductGalleryImage(images[active + 1] ?? "");
    preloadProductGalleryImage(images[active - 1] ?? "");
  }, [active, images]);

  useEffect(() => {
    if (outOfStock || inactiveListing) return;
    if (stockQty < 1) return;
    setAddQty((q) => {
      if (q < 1) return 1;
      if (q > stockQty) return stockQty;
      return q;
    });
  }, [outOfStock, inactiveListing, stockQty, product.id]);

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
    if (!audioTrack) {
      setIsAudioPlaying(false);
      setIsAudioMuted(false);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;

    const storageKey = `vero7:audio-pos:${audioTrack.src}`;

    const savedPos = (() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return 0;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : 0;
      } catch {
        return 0;
      }
    })();

    const seekToSaved = () => {
      if (savedPos > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
        try {
          audio.currentTime = Math.min(savedPos, Math.max(0, audio.duration - 0.5));
        } catch {
          // ignore
        }
      }
    };

    if (audio.readyState >= 1) {
      seekToSaved();
    } else {
      audio.addEventListener("loadedmetadata", seekToSaved, { once: true });
    }

    audio.volume = 0.6;
    audio.muted = false;

    const onPlay = () => {
      setIsAudioPlaying(true);
      setIsAudioMuted(audio.muted);
    };
    const onPause = () => setIsAudioPlaying(false);
    const onEnded = () => setIsAudioPlaying(false);
    const onVolumeChange = () => setIsAudioMuted(audio.muted);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("volumechange", onVolumeChange);

    let lastSaved = 0;
    const persistPos = () => {
      if (!Number.isFinite(audio.currentTime)) return;
      try {
        window.localStorage.setItem(storageKey, String(audio.currentTime));
      } catch {
        // ignore quota / privacy errors
      }
    };
    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSaved < 1000) return;
      lastSaved = now;
      persistPos();
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    const onPageHide = () => persistPos();
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    // Page restored from BFCache (browser back/forward, sometimes also F5):
    // re-attempt audible playback because the user gesture is preserved.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        audio.muted = false;
        setIsAudioMuted(false);
        audio.play().catch(() => {});
      }
    };
    window.addEventListener("pageshow", onPageShow);

    const UNLOCK_EVENTS = [
      "pointerdown",
      "mousedown",
      "click",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
      "mousemove",
    ] as const;

    let detachUnlock: (() => void) | null = null;

    const unlockAndPlay = () => {
      audio.muted = false;
      audio.volume = 0.6;
      setIsAudioMuted(false);
      audio.play().catch(() => {});
      if (detachUnlock) {
        detachUnlock();
        detachUnlock = null;
      }
    };

    const armUnlockListeners = () => {
      const opts = { passive: true } as const;
      UNLOCK_EVENTS.forEach((ev) => window.addEventListener(ev, unlockAndPlay, opts));
      detachUnlock = () => {
        UNLOCK_EVENTS.forEach((ev) => window.removeEventListener(ev, unlockAndPlay));
      };
    };

    const tryAutoplay = async () => {
      try {
        await audio.play();
        setIsAudioMuted(audio.muted);
      } catch {
        try {
          audio.muted = true;
          setIsAudioMuted(true);
          await audio.play();
        } catch {
          // Attend un geste utilisateur (bouton bande-son).
        }
        armUnlockListeners();
      }
    };

    void tryAutoplay();

    return () => {
      persistPos();
      audio.removeEventListener("loadedmetadata", seekToSaved);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("volumechange", onVolumeChange);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      if (detachUnlock) detachUnlock();
      audio.pause();
      setIsAudioPlaying(false);
    };
  }, [audioTrack]);

  const toggleAudioPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.muted = false;
      audio.volume = 0.6;
      setIsAudioMuted(false);
      audio.play().catch(() => {});
    } else if (audio.muted) {
      audio.muted = false;
      audio.volume = 0.6;
      setIsAudioMuted(false);
    } else {
      audio.pause();
    }
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
    if (!quickAddOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuickAddOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [quickAddOpen]);

  useEffect(() => {
    const onResizeOrScroll = () => {
      if (typeof window === "undefined") return;
      const el = stickyTriggerRef.current ?? sizeSectionRef.current;
      if (!el) {
        setShowStickyCart(false);
        return;
      }
      // Show sticky bar once the description section is reached / scrolled past
      const pastDescription = el.getBoundingClientRect().top < 96;
      setShowStickyCart(pastDescription && !outOfStock && !inactiveListing);
    };

    onResizeOrScroll();
    window.addEventListener("scroll", onResizeOrScroll, { passive: true });
    window.addEventListener("resize", onResizeOrScroll);
    return () => {
      window.removeEventListener("scroll", onResizeOrScroll);
      window.removeEventListener("resize", onResizeOrScroll);
    };
  }, [outOfStock, inactiveListing]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ products?: Product[] }>)
      .then((d) => {
        if (cancelled) return;
        const all = Array.isArray(d.products) ? d.products : [];
        const ranked = all
          .filter((p) => p.id !== product.id && isProductListedForSale(p))
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
      trackMetaAddToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        discountPrice: product.discount_price,
      });
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

  const categoryLabel = product.category_name?.trim() || t("product.defaultCategory");
  const titleUpper = product.name.toUpperCase();

  const mainSrc = images[Math.min(active, images.length - 1)] ?? PLACEHOLDER;
  const hasMultipleImages = images.length > 1;
  const canGoPrev = active > 0;
  const canGoNext = active < images.length - 1;
  const showPrevImage = () => setActive((prev) => Math.max(0, prev - 1));
  const showNextImage = () => setActive((prev) => Math.min(images.length - 1, prev + 1));
  const galleryNavBtnClass = (enabled: boolean) =>
    `pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition sm:h-11 sm:w-11 ${
      enabled
        ? "border-white/25 bg-black/50 text-white hover:border-white/40 hover:bg-black/65 active:scale-[0.97]"
        : "cursor-not-allowed border-white/10 bg-black/25 text-white/35 opacity-50"
    }`;
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
      <div
        className={`transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          pageRevealed ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!pageRevealed}
      >
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1400px] px-0 pb-8 pt-0 sm:px-6 sm:pb-10 sm:pt-0 lg:px-10 lg:pb-12 lg:pt-0">
        <div className="w-full min-w-0 px-4 pb-5 pt-8 sm:px-0 sm:pb-7 sm:pt-10">
          <nav
            className="min-w-0 truncate whitespace-nowrap text-[9px] font-normal uppercase tracking-[0.08em] text-zinc-400 sm:text-xs"
            aria-label={t("customerService.breadcrumb")}
            title={product.name}
          >
            <Link
              href="/"
              className="transition hover:text-zinc-700"
              onClick={() => requestSplashTransition()}
            >
              {t("product.home")}
            </Link>
            <span className="mx-1 text-zinc-300 sm:mx-2">/</span>
            <Link href="/collection" className="transition hover:text-zinc-700">
              {t("product.collection")}
            </Link>
            <span className="mx-1 text-zinc-300 sm:mx-2">/</span>
            <span>{categoryLabel}</span>
            <span className="mx-1 text-zinc-300 sm:mx-2">/</span>
            <span className="font-bold tracking-[0.06em] text-black">{product.name}</span>
          </nav>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:gap-14">
          {/* Galerie */}
          <div className="flex flex-col gap-3 lg:mx-auto lg:w-full lg:max-w-[38rem] xl:max-w-[40rem]">
            {/* Cadre fixe 544×580 — object-cover pour taille identique sur toutes les images */}
            <div className="group/main-gallery relative mx-auto aspect-[544/580] w-full max-w-[min(544px,calc(min(85dvh,580px)*544/580))] shrink-0 overflow-hidden bg-zinc-100 ring-1 ring-black/[0.04] transition-shadow hover:ring-black/10 lg:max-w-[544px] lg:h-[580px] lg:w-[544px] lg:max-h-[580px] lg:aspect-auto lg:flex-none">
              {images.map((src, i) => {
                const isActive = active === i;
                return (
                  <Image
                    key={`${product.id}-gallery-${src}-${i}`}
                    src={src}
                    alt={isActive ? product.name : ""}
                    fill
                    priority={i === 0}
                    /* Keep every slide mounted + eager so thumb/arrow swaps are instant. */
                    loading="eager"
                    fetchPriority={i === 0 ? "high" : i < 3 ? "auto" : "low"}
                    sizes={PRODUCT_GALLERY_SIZES}
                    unoptimized={shouldBypassImageOptimization(src)}
                    aria-hidden={!isActive}
                    className={`absolute inset-0 object-cover object-center transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                      isActive
                        ? "z-[1] opacity-100"
                        : "pointer-events-none z-0 opacity-0"
                    }`}
                    style={
                      isActive
                        ? { transition: "opacity 150ms ease-out, transform 500ms ease-out" }
                        : undefined
                    }
                  />
                );
              })}
              {!hoverMag ? (
                <div
                  className="pointer-events-none absolute bottom-3 left-3 z-[11] hidden max-w-[14rem] items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-2.5 py-1.5 text-[10px] font-medium text-zinc-700 shadow-md backdrop-blur-sm sm:gap-2 sm:text-[11px] [@media(hover:hover)_and_(min-width:1024px)]:flex [@media(pointer:coarse)]:hidden"
                  aria-hidden
                >
                  <ZoomIn className="h-3.5 w-3.5 shrink-0 text-zinc-500 sm:h-4 sm:w-4" />
                  <span className="leading-tight">{t("product.hoverZoomHint")}</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setLightboxIndex(active);
                  setImageZoomOpen(true);
                }}
                onPointerMove={(e) => {
                  if (e.pointerType !== "mouse") return;
                  const el = e.currentTarget;
                  const r = el.getBoundingClientRect();
                  if (r.width < 1 || r.height < 1) return;
                  const px = e.clientX - r.left;
                  const py = e.clientY - r.top;
                  const next = hoverMagFromPointer(px, py, r.width, r.height);
                  magTargetRef.current = next;
                  setHoverMag((prev) => prev ?? next);
                  runMagLoop();
                }}
                onPointerLeave={() => {
                  magTargetRef.current = null;
                  stopMagLoop();
                  setHoverMag(null);
                }}
                className="absolute inset-0 z-10 cursor-zoom-in outline-offset-[-2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/40"
                aria-label={t("product.zoomProductImage")}
              />
              {inactiveListing ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[12] bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-10"
                  role="status"
                >
                  <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white sm:text-xs">
                    <ListingLockIcon className="h-3.5 w-3.5 shrink-0" />
                    {t("product.comingSoon")}
                  </p>
                </div>
              ) : outOfStock ? (
                <div
                  className="pointer-events-none absolute right-2 top-2 z-20 sm:right-3 sm:top-3"
                  role="status"
                >
                  <span className="inline-block whitespace-nowrap rounded-md bg-red-600 px-2.5 py-1.5 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white shadow-md sm:px-3 sm:text-xs sm:tracking-wider">
                    {t("product.outOfStock")}
                  </span>
                </div>
              ) : null}
              {hasMultipleImages ? (
                <>
                  <button
                    type="button"
                    disabled={!canGoPrev}
                    onClick={(e) => {
                      e.stopPropagation();
                      showPrevImage();
                    }}
                    aria-label={t("product.prevImage")}
                    className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 sm:left-3 ${galleryNavBtnClass(canGoPrev)}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={!canGoNext}
                    onClick={(e) => {
                      e.stopPropagation();
                      showNextImage();
                    }}
                    aria-label={t("product.nextImage")}
                    className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 sm:right-3 ${galleryNavBtnClass(canGoNext)}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              ) : null}
              {!outOfStock && !inactiveListing ? (
                <button
                  ref={favBtnRef}
                  type="button"
                  aria-label={fav ? t("product.removeFromWishlist") : t("product.addToWishlist")}
                  aria-pressed={fav}
                  onClick={onToggleFav}
                  className={`absolute right-2 top-2 z-20 rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm transition hover:bg-white ${
                    fav ? "text-red-600" : "text-black"
                  } ${favFx ? "favorite-pop" : ""}`}
                >
                  <HeartIcon filled={fav} className="h-5 w-5" />
                </button>
              ) : null}
              {hasMultipleImages ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[21] flex justify-center px-4 sm:bottom-4">
                  <div
                    className="pointer-events-auto flex max-w-[13.5rem] items-center gap-1 overflow-x-auto rounded-full bg-[#e8e8e8] px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)] [scrollbar-width:none] sm:max-w-[15.5rem] sm:gap-1.5 sm:px-2 sm:py-1.5 [&::-webkit-scrollbar]:hidden"
                    role="tablist"
                    aria-label={t("product.gallery")}
                  >
                    {images.map((src, i) => {
                      const isActive = active === i;
                      return (
                        <button
                          key={`overlay-thumb-${src}-${i}`}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActive(i);
                          }}
                          onPointerEnter={() => preloadProductGalleryImage(src)}
                          onFocus={() => preloadProductGalleryImage(src)}
                          aria-label={t("product.imageN", { n: i + 1 })}
                          className={`shrink-0 rounded-[8px] border-2 p-px transition sm:rounded-[9px] ${
                            isActive
                              ? "border-black bg-white"
                              : "border-transparent bg-transparent opacity-90"
                          }`}
                        >
                          <span className="relative block h-8 w-8 overflow-hidden rounded-[6px] bg-[#f3f3f3] sm:h-9 sm:w-9 sm:rounded-[7px]">
                            <Image
                              src={src}
                              alt=""
                              fill
                              sizes="36px"
                              loading={i < 4 ? "eager" : "lazy"}
                              unoptimized={shouldBypassImageOptimization(src)}
                              className={`object-cover object-center ${isActive ? "" : "opacity-85"}`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {hoverMag ? (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-[11] hidden overflow-hidden rounded-2xl border border-white/95 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-black/10 will-change-transform [@media(hover:hover)_and_(min-width:1024px)]:block [@media(pointer:coarse)]:hidden"
                  style={{
                    width: MAG_LENS_W,
                    height: MAG_LENS_H,
                    transform: `translate3d(${hoverMag.left}px, ${hoverMag.top}px, 0)`,
                  }}
                  aria-hidden
                >
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage: `url("${mainSrc.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`,
                      backgroundSize: "240% 240%",
                      backgroundPosition: `${hoverMag.nx * 100}% ${hoverMag.ny * 100}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Infos */}
          <div className="mx-auto flex w-full min-w-0 max-w-sm flex-col px-4 sm:max-w-md sm:px-0 lg:mx-0 lg:max-w-none lg:pt-2">
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <p className="text-[11px] font-bold italic uppercase tracking-[0.14em] text-zinc-400">
                Vero7
              </p>
              {audioTrack ? (
                <button
                  type="button"
                  onClick={toggleAudioPlayback}
                  aria-label={
                    isAudioPlaying && !isAudioMuted
                      ? t("product.pauseMusic")
                      : t("product.playMusic")
                  }
                  aria-pressed={isAudioPlaying && !isAudioMuted}
                  title={
                    isAudioMuted
                      ? t("product.unmuteTitle", { title: audioTrack.title })
                      : isAudioPlaying
                        ? audioTrack.title
                        : t("product.playTitle", { title: audioTrack.title })
                  }
                  className={`audio-toggle audio-toggle--${audioTrack.theme} ${
                    isAudioPlaying && !isAudioMuted ? "is-playing" : ""
                  } ${isAudioMuted ? "is-muted" : ""}`}
                >
                  <span className="audio-toggle__halo" aria-hidden />
                  <span className="audio-toggle__core">
                    {isAudioMuted ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="audio-toggle__icon"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M3 10v4a1 1 0 0 0 1 1h3l4 3.5a1 1 0 0 0 1.7-.8V6.3a1 1 0 0 0-1.7-.8L7 9H4a1 1 0 0 0-1 1Z" />
                        <path
                          d="m16.5 9 4 4m0-4-4 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                    ) : isAudioPlaying ? (
                      <span className="audio-toggle__eq" aria-hidden>
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="audio-toggle__icon"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
                      </svg>
                    )}
                  </span>
                  {isAudioMuted ? (
                    <span className="audio-toggle__hint" aria-hidden>
                      {t("product.clickToUnmute")}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>

            <div className="mt-2 flex items-start justify-between gap-4 border-b border-black/10 pb-6">
              <h1 className="max-w-[90%] text-xl font-bold uppercase leading-[1.15] tracking-tight sm:text-2xl lg:text-[1.65rem] lg:leading-tight">
                {titleUpper}
              </h1>
              {discountPercent != null ? (
                <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  {t("product.saleBadge", { percent: discountPercent })}
                </span>
              ) : inactiveListing ? (
                <span className="shrink-0 rounded bg-black px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  {t("product.comingSoon")}
                </span>
              ) : (
                <span />
              )}
            </div>

            <div className="mt-6 flex items-baseline justify-between gap-3 text-lg tabular-nums sm:text-xl">
              <span className="font-semibold text-black">{formatMoney(displayPrice)}</span>
              {compareAt != null ? (
                <span className="text-base font-normal text-zinc-400 line-through">
                  {formatMoney(compareAt)}
                </span>
              ) : (
                <span />
              )}
            </div>

            <div className="mt-10">
              <div
                className={
                  outOfStock || inactiveListing
                    ? "space-y-2"
                    : "flex items-end justify-between gap-4"
                }
              >
                <div className="relative z-20 min-w-0 flex-1">
                  <p className="text-sm font-semibold text-black">
                    {colorChoices.length > 1 ? (
                      <>
                        {colorChoices.length === 2 ? t("product.designBicolor") : t("product.designMultiColor")}
                        <span className="font-medium text-zinc-700">
                          {colorChoices.map((c) => c.label).join(" · ")}
                        </span>
                      </>
                    ) : (
                      <>
                        {t("product.colorWithColon")}{" "}
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
                {!outOfStock && !inactiveListing ? (
                  <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
                    <p className="text-sm font-semibold text-black">{t("common.quantity")}</p>
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
              {inactiveListing ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-black">{t("product.sizes")}</p>
                    {product.size_guide_image ? (
                      <button
                        type="button"
                        onClick={() => setSizeGuideOpen(true)}
                        className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                      >
                        {t("product.sizeGuide")}
                      </button>
                    ) : null}
                  </div>
                  {sizeOptions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sizeOptions.map(({ label }) => (
                        <span
                          key={label}
                          className="inline-flex min-w-[2.75rem] items-center justify-center border border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div
                    className="mt-6 rounded-xl bg-black px-4 py-4"
                    role="status"
                  >
                    <p className="flex items-start gap-2.5 text-sm leading-relaxed text-white/90">
                      <ListingLockIcon className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                      <span>
                        {t("product.notListedMessage")}{" "}
                        <Link
                          href="/collection"
                          className="font-semibold text-white underline decoration-white/40 underline-offset-2 transition hover:decoration-white"
                        >
                          {t("product.browseCollection")}
                        </Link>
                        .
                      </span>
                    </p>
                  </div>
                </>
              ) : outOfStock ? (
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
                    {t("product.outOfStockNoOrder")}
                  </p>
                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-700">{t("product.sizeWithColon")}</p>
                    {product.size_guide_image ? (
                      <button
                        type="button"
                        onClick={() => setSizeGuideOpen(true)}
                        className="text-xs font-semibold uppercase tracking-wider text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                      >
                        {t("product.sizeGuide")}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-black">{t("common.size")}</p>
                    {product.size_guide_image ? (
                      <button
                        type="button"
                        onClick={() => setSizeGuideOpen(true)}
                        className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                      >
                        {t("product.sizeGuide")}
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
                  {!hasPickedSize ? (
                    <p className="mt-2 text-xs font-medium text-zinc-600" role="status">
                      {t("product.selectSizeToContinue")}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {inactiveListing ? (
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled
                  className="flex-1 cursor-not-allowed bg-black py-3.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-white opacity-70"
                >
                  {t("product.comingSoon")}
                </button>
                <Link
                  href="/collection"
                  className="flex flex-1 items-center justify-center border-2 border-black bg-white py-3.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-black hover:text-white"
                >
                  {t("cart.viewCollection")}
                </Link>
              </div>
            ) : outOfStock ? (
              <button
                type="button"
                disabled
                className="mt-10 w-full max-w-sm cursor-not-allowed border-0 bg-zinc-400 py-3.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-white lg:max-w-none"
              >
                {t("product.outOfStockUpper")}
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
                className="mt-10 flex w-full max-w-sm items-center justify-between bg-black px-4 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 lg:max-w-none"
              >
                <span>{t("product.addToCartUpper")}</span>
                <span>{formatMoney(displayPrice)}</span>
              </button>
            )}

            {(product.description?.trim() ? true : false) ? (
              <div ref={stickyTriggerRef} className="mt-10 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setOpenInfoPanel((prev) => (prev === "description" ? null : "description"))}
                  aria-expanded={openInfoPanel === "description"}
                  className="flex w-full items-center justify-between py-4 text-left"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-800">
                    {t("product.descriptionTitle")}
                  </span>
                  <span className="text-black" aria-hidden>
                    {openInfoPanel === "description" ? "-" : "+"}
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-200 ${
                    openInfoPanel === "description" ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{product.description}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={stickyTriggerRef} className="mt-10" aria-hidden />
            )}

            <div className="border-t border-black/10">
              <button
                type="button"
                onClick={() => setOpenInfoPanel((prev) => (prev === "shipping" ? null : "shipping"))}
                aria-expanded={openInfoPanel === "shipping"}
                className="flex w-full items-center justify-between py-4 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-800">
                  {t("product.shipping")}
                </span>
                <span className="text-black" aria-hidden>
                  {openInfoPanel === "shipping" ? "-" : "+"}
                </span>
              </button>
              <div
                className={`grid transition-all duration-200 ${
                  openInfoPanel === "shipping" ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <ul className="space-y-2 text-sm leading-relaxed text-zinc-700">
                    <li>{t("product.shippingDelivery")}</li>
                    <li>{t("product.shippingFreeOver")}</li>
                    <li>{t("product.shippingReturns")}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {suggestions.length > 0 ? (
        <section className="mx-auto w-full max-w-[1600px] px-4 pb-16 sm:px-6 lg:px-10">
          <h2 className="text-3xl font-black uppercase tracking-tight text-black">{t("product.youMayAlsoLike")}</h2>
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
                        unoptimized={shouldBypassImageOptimization(src)}
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                      />
                    </Link>
                    <button
                      type="button"
                      aria-label={isSuggestedFav ? t("product.removeFromWishlist") : t("product.addToWishlist")}
                      aria-pressed={isSuggestedFav}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const isNowFavorite = toggleWishlistId(p.id);
                        if (isNowFavorite) {
                          trackMetaAddToWishlist({
                            id: p.id,
                            name: p.name,
                            price: p.price,
                            discountPrice: p.discount_price,
                          });
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
                      aria-label={t("product.addToCart")}
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
                          {t("product.productSize")}
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
                          <span className="text-zinc-400 line-through">{formatMoney(list)}</span>
                        ) : (
                          <span />
                        )}
                        <span className="ml-auto shrink-0 font-semibold text-black">{formatMoney(sale)}</span>
                      </p>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {showStickyCart ? (
        <div className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] right-2.5 z-[110] sm:bottom-6 sm:right-6">
          <div className="w-[min(17.5rem,calc(100vw-1.25rem))] rounded-2xl bg-white p-2 shadow-[0_10px_32px_rgba(0,0,0,0.16)] sm:w-[19rem] sm:p-2.5">
            <div className="flex items-start gap-2 sm:gap-2.5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:h-16 sm:w-16">
                <Image
                  src={mainSrc}
                  alt=""
                  fill
                  sizes="64px"
                  unoptimized={shouldBypassImageOptimization(mainSrc)}
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.04em] text-black sm:text-[11px]">
                      {titleUpper}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] italic text-zinc-500 sm:text-[10px]">
                      {(colorForCart || "—").toUpperCase()}
                      {selectedSize ? ` / ${selectedSize}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 pt-0.5 text-[10px] font-medium italic tabular-nums text-zinc-500 sm:text-[11px]">
                    {formatMoney(displayPrice)}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 sm:mt-2 sm:gap-2">
                  <QuantityStepper
                    value={addQty}
                    onChange={setAddQty}
                    min={1}
                    max={Math.max(1, stockQty)}
                    disabled={stockQty < 1}
                    mini
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const readySize =
                        selectedSize && sizeOptions.some((o) => o.label === selectedSize && o.available)
                          ? selectedSize
                          : null;
                      if (readySize) {
                        addToCartWithFeedback(sizeSectionRef.current, readySize);
                        return;
                      }
                      setQuickAddSize(null);
                      setQuickAddOpen(true);
                    }}
                    className="h-6 min-w-0 flex-1 rounded-full bg-black px-3 text-[9px] font-bold uppercase italic tracking-[0.06em] text-white transition hover:bg-zinc-800 sm:h-7 sm:text-[10px]"
                  >
                    {t("product.addShort")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {quickAddOpen && !outOfStock && !inactiveListing ? (
        <div className="fixed inset-0 z-[130]">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t("common.close")}
            onClick={() => setQuickAddOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-5">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200 sm:hidden" aria-hidden />
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-black uppercase leading-tight text-black">{titleUpper}</h3>
                <p className="mt-1 text-sm font-semibold text-black">{formatMoney(displayPrice)}</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                aria-label={t("common.close")}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <p className="mt-4 text-sm font-semibold text-black">{t("product.selectSizeToContinue")}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {sizeOptions.map(({ label, available }) => (
                <button
                  key={`quick-add-${label}`}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    if (!available) return;
                    setQuickAddSize(label);
                    setSelectedSize(label);
                    addToCartWithFeedback(sizeSectionRef.current, label);
                    setQuickAddOpen(false);
                  }}
                  className={
                    !available
                      ? "w-full cursor-not-allowed border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 line-through decoration-zinc-400"
                      : quickAddSize === label
                        ? "w-full border border-black bg-black px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-white"
                        : "w-full border border-black/15 bg-white px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-black transition hover:border-black/40"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <SiteFooter />
      </div>

      <ProductImageLightbox
        open={imageZoomOpen}
        onClose={() => setImageZoomOpen(false)}
        images={images}
        activeIndex={lightboxIndex}
        onActiveChange={(i) => {
          setLightboxIndex(i);
          setActive(i);
        }}
        productName={product.name}
      />

      {audioTrack ? (
        <audio
          ref={audioRef}
          src={audioTrack.src}
          loop
          preload="auto"
          autoPlay
          playsInline
        />
      ) : null}

      {sizeGuideOpen && product.size_guide_image ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 sm:p-8"
          role="presentation"
          onClick={() => setSizeGuideOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            role="dialog"
            aria-label={t("product.sizeGuide")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
              <p className="text-sm font-semibold">{t("product.sizeGuide")}</p>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                aria-label={t("common.close")}
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
                  alt={t("product.sizeGuide")}
                  width={1200}
                  height={1600}
                  className="h-auto w-full object-contain"
                  unoptimized={shouldBypassImageOptimization(product.size_guide_image)}
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
                  unoptimized={shouldBypassImageOptimization(mainSrc)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-black">{t("product.addedToFavorites")}</p>
                <Link
                  href="/favoris"
                  className="text-xs font-medium text-zinc-600 underline underline-offset-2 transition hover:text-black"
                >
                  {t("product.viewMyFavorites")}
                </Link>
              </div>
            </>
          ) : (
            <p className="pr-1 text-sm font-medium text-black">{t("product.removedFromFavorites")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

