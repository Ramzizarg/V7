"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HeaderMegaMenu, { type MegaMenuKey } from "@/components/HeaderMegaMenu";
import { CartSidebar } from "@/components/shop/CartSidebar";
import { trackMetaSearch } from "@/lib/metaPixel";
import {
  CART_ADDED_EVENT,
  CART_SIDEBAR_OPEN_EVENT,
  cancelPendingCartSidebarOpen,
  FAVORIS_ADDED_EVENT,
} from "@/lib/favorisUx";
import { isProductAvailableForPurchase } from "@/lib/productListing";
import { productPathSlug } from "@/lib/productUrl";
import { getCartItemCount, getWishlistCount } from "@/lib/shopClientStorage";
import { requestSplashTransition } from "@/lib/splashTransition";
import type { Product } from "@/lib/types";

const promoMessages = [
  "Livraison standard offerte des 200 DT d'achat",
  "Retours gratuits sous 14 jours",
  "Nouveaux essentiels de saison disponibles",
  "Paiement securise et livraison rapide",
];

const NAV_LINKS = [
  { href: "/collection", label: "Homme", mega: "hommes" as const },
  { href: "/collection", label: "Femme", mega: "femmes" as const },
  { href: "/collection", label: "Lifestyle" },
  { href: "/collection", label: "Accessoires" },
] as const;

const MEGA_MENU_CLOSE_DELAY_MS = 120;

const desktopNavLinkClass =
  "relative whitespace-nowrap pb-0.5 text-sm font-medium text-black transition after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-black after:transition-transform hover:after:scale-x-100";

/**
 * Header identique a l'accueil (`page.tsx`) : bandeau promo, menu, recherche.
 * Liens ancres pointent vers `/#...` pour fonctionner depuis /collection etc.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const [favIconBump, setFavIconBump] = useState(false);
  const [cartIconBump, setCartIconBump] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [searchProductsLoading, setSearchProductsLoading] = useState(false);
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);
  const [activeMegaMenu, setActiveMegaMenu] = useState<MegaMenuKey | null>(null);
  const megaMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchTrackedRef = useRef("");

  const featuredMegaImages = useMemo(
    () =>
      searchProducts
        .map((p) => (Array.isArray(p.images) && p.images[0] ? p.images[0] : null))
        .filter((src): src is string => Boolean(src))
        .slice(0, 4),
    [searchProducts]
  );

  const openMegaMenu = useCallback((key: MegaMenuKey) => {
    if (megaMenuCloseTimerRef.current != null) {
      clearTimeout(megaMenuCloseTimerRef.current);
      megaMenuCloseTimerRef.current = null;
    }
    setActiveMegaMenu(key);
  }, []);

  const scheduleMegaMenuClose = useCallback(() => {
    if (megaMenuCloseTimerRef.current != null) clearTimeout(megaMenuCloseTimerRef.current);
    megaMenuCloseTimerRef.current = setTimeout(() => {
      setActiveMegaMenu(null);
      megaMenuCloseTimerRef.current = null;
    }, MEGA_MENU_CLOSE_DELAY_MS);
  }, []);

  const closeMegaMenu = useCallback(() => {
    if (megaMenuCloseTimerRef.current != null) {
      clearTimeout(megaMenuCloseTimerRef.current);
      megaMenuCloseTimerRef.current = null;
    }
    setActiveMegaMenu(null);
  }, []);

  useEffect(() => {
    return () => {
      if (megaMenuCloseTimerRef.current != null) clearTimeout(megaMenuCloseTimerRef.current);
    };
  }, []);

  const closeSearch = useCallback(() => {
    setSearchClosing(true);
    setSearchVisible(false);
    window.setTimeout(() => {
      setSearchOpen(false);
      setSearchClosing(false);
      setSearchQuery("");
    }, 300);
  }, []);

  const openSearch = useCallback(() => {
    setMobileMenuOpen(false);
    closeMegaMenu();
    setSearchClosing(false);
    setSearchOpen(true);
    setSearchVisible(false);
    requestAnimationFrame(() => setSearchVisible(true));
  }, [closeMegaMenu]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6500);

    setSearchProductsLoading(true);
    fetch("/api/products", { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { products?: Product[] }) => {
        if (!cancelled) {
          const list = (data.products ?? []).filter(isProductAvailableForPurchase);
          setSearchProducts(list);
        }
      })
      .catch(() => {
        if (!cancelled) setSearchProducts([]);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!cancelled) setSearchProductsLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!searchOpen || searchClosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [searchOpen, searchClosing, closeSearch]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const timeoutId = window.setTimeout(() => {
      if (lastSearchTrackedRef.current === q) return;
      lastSearchTrackedRef.current = q;
      trackMetaSearch(q);
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const sync = () => {
      setCartCount(getCartItemCount());
      setFavCount(getWishlistCount());
    };
    sync();
    window.addEventListener("vero7-storage", sync);
    return () => window.removeEventListener("vero7-storage", sync);
  }, []);

  useEffect(() => {
    const onOpenCartSidebar = () => setCartSidebarOpen(true);
    window.addEventListener(CART_SIDEBAR_OPEN_EVENT, onOpenCartSidebar);
    return () => window.removeEventListener(CART_SIDEBAR_OPEN_EVENT, onOpenCartSidebar);
  }, []);

  useEffect(() => {
    if (cartSidebarOpen) cancelPendingCartSidebarOpen();
  }, [cartSidebarOpen]);

  useEffect(() => {
    const onFavAdded = () => {
      setFavIconBump(true);
      window.setTimeout(() => setFavIconBump(false), 520);
    };
    const onCartAdded = () => {
      setCartIconBump(true);
      window.setTimeout(() => setCartIconBump(false), 520);
    };
    window.addEventListener(FAVORIS_ADDED_EVENT, onFavAdded);
    window.addEventListener(CART_ADDED_EVENT, onCartAdded);
    return () => {
      window.removeEventListener(FAVORIS_ADDED_EVENT, onFavAdded);
      window.removeEventListener(CART_ADDED_EVENT, onCartAdded);
    };
  }, []);

  return (
    <>
      {activeMegaMenu && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[25] hidden bg-white/30 backdrop-blur-[3px] lg:block"
              style={{ top: "var(--site-header-height, 6.5rem)" }}
              aria-hidden
              onMouseEnter={scheduleMegaMenuClose}
            />,
            document.body
          )
        : null}
    <header
      className={`sticky top-0 z-30 bg-white ${activeMegaMenu ? "" : "border-b border-black/10"}`}
      style={{ ["--site-header-height" as string]: "calc(2rem + 4.25rem)" }}
    >
      <div className="bg-red-700 text-white">
        <div className="promo-marquee h-8">
          <div className="promo-marquee-track text-[11px]">
            {[0, 1, 2].map((copy) => (
              <div key={copy} className="promo-marquee-group" aria-hidden={copy > 0}>
                {promoMessages.map((message) => (
                  <span key={`${copy}-${message}`} className="uppercase tracking-[0.02em]">
                    {message}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Mobile header */}
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-2 sm:px-5 lg:hidden">
        <div className="flex items-center gap-0.5 text-black">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="rounded-full p-2 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              {mobileMenuOpen ? (
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <button
            type="button"
            aria-label="Rechercher"
            onClick={openSearch}
            className="rounded-full p-2 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <Link
          href="/"
          className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center"
          aria-label="Accueil Vero7 — retour à la page d'accueil"
          onClick={(e) => {
            if (pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
              return;
            }
            requestSplashTransition();
          }}
        >
          <Image
            src="/vero7-logo.png"
            alt="Vero7"
            width={72}
            height={72}
            className="h-12 w-auto object-contain sm:h-14"
            priority
            loading="eager"
          />
        </Link>
        <div className="flex items-center gap-1 text-black">
          <Link
            id="site-header-favoris"
            href="/favoris"
            className={`relative isolate rounded-full p-2 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
              favIconBump ? "favorite-pop" : ""
            }`}
            aria-label={favCount > 0 ? `Favoris, ${favCount} article${favCount > 1 ? "s" : ""}` : "Favoris"}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M12 20s-6-3.7-8.3-7C1.6 9.7 3 6 6.4 6c2.1 0 3.2 1.2 3.6 2 .4-.8 1.5-2 3.6-2C17 6 18.4 9.7 16.3 13c-2.3 3.3-8.3 7-8.3 7Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {favCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                {favCount}
              </span>
            ) : null}
          </Link>
          <button
            id="site-header-cart"
            className={`relative isolate rounded-full p-2 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
              cartIconBump ? "favorite-pop" : ""
            }`}
            aria-label="Panier"
            type="button"
            onClick={() => setCartSidebarOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l-1 11H7L6 7Zm3 0a3 3 0 1 1 6 0" />
            </svg>
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                {cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Desktop header — nav left · logo center · search + favoris + panier right */}
      <div className="relative hidden w-full lg:block" onMouseLeave={scheduleMegaMenuClose}>
        <div className="relative flex h-[4.25rem] w-full items-center justify-between px-4 lg:px-6 xl:px-10">
          <nav className="relative z-10 flex min-w-0 items-center gap-6 xl:gap-8" aria-label="Navigation principale">
            {NAV_LINKS.map((item) => {
              const isMega = "mega" in item && item.mega;
              const isActiveMega = isMega && activeMegaMenu === item.mega;
              const linkClass = `${desktopNavLinkClass}${isActiveMega ? " after:scale-x-100" : ""}`;

              if (isMega) {
                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => openMegaMenu(item.mega)}
                  >
                    <Link href={item.href} className={linkClass} onClick={closeMegaMenu}>
                      {item.label}
                    </Link>
                  </div>
                );
              }

              return (
                <Link key={item.label} href={item.href} className={linkClass} onMouseEnter={closeMegaMenu}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/"
            className="absolute left-1/2 top-1/2 z-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            aria-label="Accueil Vero7 — retour à la page d'accueil"
            onMouseEnter={closeMegaMenu}
            onClick={(e) => {
              if (pathname === "/") {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
              }
              requestSplashTransition();
            }}
          >
            <Image
              src="/vero7-logo.png"
              alt="Vero7"
              width={72}
              height={72}
              className="h-12 w-auto object-contain xl:h-14"
              priority
              loading="eager"
            />
          </Link>

          <div
            className="relative z-10 flex min-w-0 shrink-0 items-center justify-end gap-1 text-black"
            onMouseEnter={closeMegaMenu}
          >
            <button
              type="button"
              onClick={openSearch}
              className="flex min-w-0 max-w-[15rem] items-center gap-2.5 rounded-full bg-zinc-100 px-4 py-2.5 text-left transition hover:bg-zinc-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 xl:max-w-[17rem]"
              aria-label="Rechercher"
            >
              <Search className="h-4 w-4 shrink-0 text-black" strokeWidth={2} />
              <span className="truncate text-sm text-zinc-500">Que recherchez-vous ?</span>
            </button>
            <Link
              id="site-header-favoris-desktop"
              href="/favoris"
              className={`relative isolate rounded-full p-2 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
                favIconBump ? "favorite-pop" : ""
              }`}
              aria-label={favCount > 0 ? `Favoris, ${favCount} article${favCount > 1 ? "s" : ""}` : "Favoris"}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M12 20s-6-3.7-8.3-7C1.6 9.7 3 6 6.4 6c2.1 0 3.2 1.2 3.6 2 .4-.8 1.5-2 3.6-2C17 6 18.4 9.7 16.3 13c-2.3 3.3-8.3 7-8.3 7Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {favCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                  {favCount}
                </span>
              ) : null}
            </Link>
            <button
              id="site-header-cart-desktop"
              className={`relative isolate rounded-full p-2 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
                cartIconBump ? "favorite-pop" : ""
              }`}
              aria-label="Panier"
              type="button"
              onClick={() => setCartSidebarOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l-1 11H7L6 7Zm3 0a3 3 0 1 1 6 0" />
              </svg>
              {cartCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                  {cartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {activeMegaMenu ? (
          <div
            className="absolute inset-x-0 top-full z-40 border-t border-black/10 bg-white shadow-[0_24px_48px_rgba(0,0,0,0.08)]"
            onMouseEnter={() => openMegaMenu(activeMegaMenu)}
          >
            <HeaderMegaMenu
              active={activeMegaMenu}
              featuredImages={featuredMegaImages}
              onClose={closeMegaMenu}
            />
          </div>
        ) : null}
      </div>
      {mobileMenuOpen ? (
        <nav className="border-t border-black/10 bg-white px-5 py-4 text-sm font-medium text-black lg:hidden">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="transition hover:opacity-70"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      {(searchOpen || searchClosing) &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-[100] transition-opacity duration-300 ease-out ${
                searchOpen && !searchClosing ? "bg-black/20 opacity-100" : "pointer-events-none bg-black/20 opacity-0"
              }`}
              aria-hidden
              onClick={closeSearch}
            />
            <div
              className={`fixed left-0 right-0 top-0 z-[101] rounded-b-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
                searchOpen && !searchClosing && searchVisible ? "translate-y-0" : "-translate-y-full"
              }`}
              role="dialog"
              aria-label="Recherche"
              aria-modal="true"
            >
              <div className="px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-6 sm:pt-6">
                <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
                  <Search className="h-5 w-5 shrink-0 text-zinc-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="What are you searching?"
                    className="min-w-0 flex-1 bg-transparent text-[16px] text-black placeholder:text-zinc-400 focus:outline-none sm:text-base"
                    autoFocus
                    aria-label="Rechercher des produits"
                  />
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="shrink-0 rounded-full p-2 transition-colors hover:bg-zinc-100"
                    aria-label="Fermer la recherche"
                  >
                    <X className="h-5 w-5 text-black" />
                  </button>
                </div>
                <div className="max-h-[min(60vh,24rem)] touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain pt-4">
                  {(() => {
                    const q = searchQuery.trim().toLowerCase();
                    const filteredProducts = q
                      ? searchProducts.filter((p) => {
                          const name = typeof p.name === "string" ? p.name.trim().toLowerCase() : "";
                          const slug = typeof p.slug === "string" ? p.slug.trim().toLowerCase() : "";
                          return (name && name.includes(q)) || (slug && slug.includes(q));
                        })
                      : [...searchProducts];
                    return (
                      <>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          {q
                            ? `Results${filteredProducts.length > 0 ? ` (${filteredProducts.length})` : ""}`
                            : "HIGHLIGHTS"}
                        </p>
                        {searchProductsLoading ? (
                          <p className="py-2 text-sm text-zinc-500">Chargement…</p>
                        ) : (
                          <ul className="min-w-0 space-y-0">
                            {filteredProducts.slice(0, 4).map((p) => {
                              const imgUrl = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
                              const hasDiscount = p.discount_price != null && p.discount_price < p.price;
                              const displayPrice = hasDiscount ? p.discount_price! : p.price;
                              const formatPrice = (n: number) =>
                                new Intl.NumberFormat("fr-FR", {
                                  style: "currency",
                                  currency: "TND",
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(n);
                              return (
                                <li key={p.id} className="min-w-0">
                                  <Link
                                    href={`/collection/${encodeURIComponent(productPathSlug(p))}`}
                                    onClick={closeSearch}
                                    className="-mx-2 flex min-w-0 items-center gap-3 rounded px-2 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-50 hover:text-zinc-600"
                                  >
                                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-zinc-100 sm:h-14 sm:w-14">
                                      {imgUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
                                          —
                                        </span>
                                      )}
                                    </span>
                                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                      <span className="truncate">{p.name ?? "Produit"}</span>
                                      <span className="shrink-0 text-right leading-tight">
                                        <span className="block text-xs font-semibold text-zinc-700 sm:text-sm">
                                          {formatPrice(displayPrice)}
                                        </span>
                                        {hasDiscount && (
                                          <span className="block text-[11px] text-zinc-400 line-through sm:text-xs">
                                            {formatPrice(p.price)}
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {!searchProductsLoading && searchProducts.length === 0 && (
                          <p className="py-2 text-sm text-zinc-500">Aucun produit disponible pour le moment.</p>
                        )}
                        {!searchProductsLoading && q && filteredProducts.length === 0 && (
                          <p className="py-2 text-sm text-zinc-500">Aucun resultat pour votre recherche.</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
      <CartSidebar open={cartSidebarOpen} onClose={() => setCartSidebarOpen(false)} />
    </header>
    </>
  );
}
