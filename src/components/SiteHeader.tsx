"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, X, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HeaderMegaMenu, { type MegaMenuKey } from "@/components/HeaderMegaMenu";
import { MobileNavSidebar } from "@/components/MobileNavSidebar";
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
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import { requestSplashTransition } from "@/lib/splashTransition";
import type { Product } from "@/lib/types";

const NAV_LINKS = [
  { href: "/collection", labelKey: "nav.homme", mega: "hommes" as const },
  { href: "/collection", labelKey: "nav.femme", mega: "femmes" as const },
  { href: "/collection", labelKey: "nav.lifestyle" },
  { href: "/collection", labelKey: "nav.accessoires" },
] as const;

const MEGA_MENU_CLOSE_DELAY_MS = 120;
const PROMO_ROTATE_MS = 5000;
/** White header mark (V7 icon). */
const HEADER_LOGO_SRC = "/V7/V7-2.png";
/** Hero / overlay wordmark (replaces “VERO7” text). */
const HEADER_WORDMARK_SRC = "/V7/logo-top.png";
const INSTAGRAM_URL = "https://www.instagram.com/vero7.tn/";
const FACEBOOK_URL =
  "https://www.facebook.com/share/1JVw34RVAj/?mibextid=wwXIfr";
const TIKTOK_URL = "https://www.tiktok.com/@vero7.tn";

function PromoFacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function PromoInstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function PromoTikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

const desktopNavLinkClass =
  "relative whitespace-nowrap pb-0.5 text-sm font-medium transition after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:transition-transform hover:after:scale-x-100";

function headerIconButtonClass(overlay: boolean) {
  return overlay
    ? "rounded-full p-2 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    : "rounded-full p-2 text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30";
}

function HeaderLogo({ overlay, className = "" }: { overlay: boolean; className?: string }) {
  if (overlay) {
    return (
      <Image
        src={HEADER_WORDMARK_SRC}
        alt="Vero7"
        width={120}
        height={30}
        className={`h-5 w-auto object-contain sm:h-6 ${className}`}
        priority
        loading="eager"
      />
    );
  }

  return (
    <Image
      src={HEADER_LOGO_SRC}
      alt="Vero7"
      width={64}
      height={64}
      className={`h-9 w-auto object-contain sm:h-10 ${className}`}
      priority
      loading="eager"
    />
  );
}

/**
 * Header identique a l'accueil (`page.tsx`) : bandeau promo, menu, recherche.
 * Liens ancres pointent vers `/#...` pour fonctionner depuis /collection etc.
 */
export default function SiteHeader() {
  const { t, formatMoney, pluralArticles, locale, setLocale } = useTranslations();
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
  const [promoIndex, setPromoIndex] = useState(0);
  const [promoPaused, setPromoPaused] = useState(false);
  const [homeScrolled, setHomeScrolled] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const megaMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchTrackedRef = useRef("");
  const lastScrollYRef = useRef(0);
  const pastHeroRef = useRef(false);

  const promoMessages = useMemo(
    () => [
      t("promo.freeShipping"),
      t("promo.freeReturns"),
      t("promo.newSeason"),
      t("promo.securePayment"),
    ],
    [t]
  );

  const navLinks = useMemo(
    () =>
      NAV_LINKS.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [t]
  );

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

  useEffect(() => {
    if (promoPaused) return;
    const id = window.setInterval(() => {
      setPromoIndex((i) => (i + 1) % promoMessages.length);
    }, PROMO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [promoPaused, promoMessages.length]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    pastHeroRef.current = false;
    setHeaderHidden(false);

    let observer: IntersectionObserver | null = null;

    const bindHeroObserver = () => {
      observer?.disconnect();
      observer = null;
      if (pathname !== "/") {
        pastHeroRef.current = window.scrollY > 160;
        return;
      }
      const hero = document.getElementById("home-hero");
      if (!hero) {
        pastHeroRef.current = false;
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          // true only when the hero is completely out of view
          pastHeroRef.current = !entry.isIntersecting;
          if (entry.isIntersecting) setHeaderHidden(false);
        },
        { threshold: 0, rootMargin: "0px" }
      );
      observer.observe(hero);
      pastHeroRef.current = hero.getBoundingClientRect().bottom <= 0;
    };

    bindHeroObserver();

    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const prev = lastScrollYRef.current;
      const dy = y - prev;

      if (pathname === "/") {
        setHomeScrolled(y > 48);
      } else {
        setHomeScrolled(false);
        pastHeroRef.current = y > 160;
      }

      // While hero is still visible → never hide
      if (!pastHeroRef.current) {
        setHeaderHidden(false);
      } else if (dy > 2) {
        // Past hero + scrolling down → hide
        setHeaderHidden(true);
      } else if (dy < -2) {
        // Past hero + scrolling up → show
        setHeaderHidden(false);
      }

      lastScrollYRef.current = y;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", bindHeroObserver, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", bindHeroObserver);
    };
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen || searchOpen || cartSidebarOpen || activeMegaMenu) {
      setHeaderHidden(false);
    }
  }, [mobileMenuOpen, searchOpen, cartSidebarOpen, activeMegaMenu]);

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

  const isHome = pathname === "/";
  const overlayNav =
    isHome && !homeScrolled && !activeMegaMenu && !searchOpen && !mobileMenuOpen;
  const desktopNavLinkTone = overlayNav
    ? "text-white after:bg-white"
    : "text-black after:bg-black";
  const countBadgeClass = overlayNav
    ? "ring-2 ring-black/20"
    : "ring-2 ring-white";

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
      className={`site-header fixed inset-x-0 top-0 z-30 ${
        overlayNav ? "bg-transparent" : "bg-white"
      } ${!overlayNav && !activeMegaMenu ? "border-b border-black/10" : ""} ${
        headerHidden ? "site-header--hidden" : "site-header--visible"
      }`}
      style={{ ["--site-header-height" as string]: "calc(2.25rem + 4.25rem)" }}
    >
      <div className="relative border-b border-white/10 bg-black">
        <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2.5 sm:left-4 sm:gap-3">
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white transition hover:text-white/85"
            aria-label={t("footer.facebookAria")}
          >
            <PromoFacebookIcon className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" />
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white transition hover:text-white/85"
            aria-label={t("footer.instagramAria")}
          >
            <PromoInstagramIcon className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" />
          </a>
          <a
            href={TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white transition hover:text-white/85"
            aria-label={t("footer.tiktokAria")}
          >
            <PromoTikTokIcon className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" />
          </a>
        </div>
        <div className="flex h-9 items-center justify-center px-16 sm:h-10 sm:px-20">
          <p
            key={promoIndex}
            className="promo-fade-in text-center text-[11px] font-medium text-white underline decoration-white/80 underline-offset-2 sm:text-xs"
          >
            {promoMessages[promoIndex]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPromoPaused((prev) => !prev)}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-white transition hover:bg-white/10"
          aria-label={promoPaused ? "Reprendre les annonces" : "Mettre en pause les annonces"}
        >
          {promoPaused ? <Play className="h-4 w-4" strokeWidth={2.5} /> : <Pause className="h-4 w-4" strokeWidth={2.5} />}
        </button>
      </div>
      {/* Mobile header */}
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-3 sm:px-5 lg:hidden">
        <div className={`flex items-center gap-0.5 ${overlayNav ? "text-white" : "text-black"}`}>
          <button
            type="button"
            aria-label={t("nav.openMenu")}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={headerIconButtonClass(overlayNav)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 9h16M4 15h16" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={t("nav.search")}
            onClick={openSearch}
            className={headerIconButtonClass(overlayNav)}
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
          aria-label={t("nav.homeAria")}
          onClick={(e) => {
            if (pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
              return;
            }
            requestSplashTransition();
          }}
        >
          <HeaderLogo overlay={overlayNav} />
        </Link>
        <div className={`flex items-center gap-0.5 ${overlayNav ? "text-white" : "text-black"}`}>
          <Link
            id="site-header-favoris"
            href="/favoris"
            className={`relative isolate ${headerIconButtonClass(overlayNav)} ${
              favIconBump ? "favorite-pop" : ""
            }`}
            aria-label={
              favCount > 0
                ? t("nav.wishlistCount", { count: favCount, articles: pluralArticles(favCount) })
                : t("nav.wishlist")
            }
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M12 20s-6-3.7-8.3-7C1.6 9.7 3 6 6.4 6c2.1 0 3.2 1.2 3.6 2 .4-.8 1.5-2 3.6-2C17 6 18.4 9.7 16.3 13c-2.3 3.3-8.3 7-8.3 7Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {favCount > 0 ? (
              <span
                className={`absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ${countBadgeClass}`}
              >
                {favCount}
              </span>
            ) : null}
          </Link>
          <button
            id="site-header-cart"
            className={`relative isolate ${headerIconButtonClass(overlayNav)} ${
              cartIconBump ? "favorite-pop" : ""
            }`}
            aria-label={t("nav.cart")}
            type="button"
            onClick={() => setCartSidebarOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 9V7a5 5 0 0 1 10 0v2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h12l-1.2 10.5H7.2L6 9Z" />
            </svg>
            {cartCount > 0 ? (
              <span
                className={`absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ${countBadgeClass}`}
              >
                {cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Desktop header — nav left · logo center · search + favoris + panier right */}
      <div className="relative hidden w-full lg:block" onMouseLeave={scheduleMegaMenuClose}>
        <div className="relative grid h-[4.25rem] w-full grid-cols-[1fr_auto_1fr] items-center px-4 lg:px-6 xl:px-10">
          <nav className="relative z-10 flex min-w-0 items-center gap-6 xl:gap-8" aria-label={t("nav.mainNav")}>
            {navLinks.map((item) => {
              const isMega = "mega" in item && item.mega;
              const isActiveMega = isMega && activeMegaMenu === item.mega;
              const linkClass = `${desktopNavLinkClass} ${desktopNavLinkTone}${isActiveMega ? " after:scale-x-100" : ""}`;

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
            className="relative z-10 flex items-center justify-center self-center"
            aria-label={t("nav.homeAria")}
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
            <HeaderLogo overlay={overlayNav} className={overlayNav ? "h-6 xl:h-7" : "xl:h-12"} />
          </Link>

          <div
            className={`relative z-10 flex min-w-0 shrink-0 items-center justify-end gap-1 ${overlayNav ? "text-white" : "text-black"}`}
            onMouseEnter={closeMegaMenu}
          >
            <div
              role="group"
              aria-label={t("nav.language")}
              className={`relative mr-1 flex items-center rounded-md p-0.5 text-[11px] font-semibold tracking-[0.08em] ${
                overlayNav ? "bg-white/15" : "bg-zinc-100"
              }`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-[5px] bg-white shadow-sm transition-all duration-200 ease-out ${
                  overlayNav ? "" : "ring-1 ring-black/5"
                } ${locale === "en" ? "left-[calc(50%+1px)]" : "left-0.5"}`}
              />
              <button
                type="button"
                onClick={() => setLocale("fr")}
                aria-pressed={locale === "fr"}
                className={`relative z-10 min-w-[2.25rem] px-2.5 py-1.5 transition-colors ${
                  locale === "fr"
                    ? "text-black"
                    : overlayNav
                      ? "text-white/55 hover:text-white/80"
                      : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
                className={`relative z-10 min-w-[2.25rem] px-2.5 py-1.5 transition-colors ${
                  locale === "en"
                    ? "text-black"
                    : overlayNav
                      ? "text-white/55 hover:text-white/80"
                      : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={openSearch}
              className={`flex min-w-0 max-w-[15rem] items-center gap-2.5 rounded-full px-4 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 xl:max-w-[17rem] ${
                overlayNav
                  ? "bg-white/15 text-white hover:bg-white/25 focus-visible:ring-white/30"
                  : "bg-zinc-100 text-black hover:bg-zinc-200/80 focus-visible:ring-black/20"
              }`}
              aria-label={t("nav.search")}
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className={`truncate text-sm ${overlayNav ? "text-white/80" : "text-zinc-500"}`}>
                {t("nav.searchPlaceholder")}
              </span>
            </button>
            <Link
              id="site-header-favoris-desktop"
              href="/favoris"
              className={`relative isolate ${headerIconButtonClass(overlayNav)} ${
                favIconBump ? "favorite-pop" : ""
              }`}
              aria-label={
                favCount > 0
                  ? t("nav.wishlistCount", { count: favCount, articles: pluralArticles(favCount) })
                  : t("nav.wishlist")
              }
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M12 20s-6-3.7-8.3-7C1.6 9.7 3 6 6.4 6c2.1 0 3.2 1.2 3.6 2 .4-.8 1.5-2 3.6-2C17 6 18.4 9.7 16.3 13c-2.3 3.3-8.3 7-8.3 7Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
              {favCount > 0 ? (
                <span
                  className={`absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ${countBadgeClass}`}
                >
                  {favCount}
                </span>
              ) : null}
            </Link>
            <button
              id="site-header-cart-desktop"
              className={`relative isolate ${headerIconButtonClass(overlayNav)} ${
                cartIconBump ? "favorite-pop" : ""
              }`}
              aria-label={t("nav.cart")}
              type="button"
              onClick={() => setCartSidebarOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 9V7a5 5 0 0 1 10 0v2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h12l-1.2 10.5H7.2L6 9Z" />
              </svg>
              {cartCount > 0 ? (
                <span
                  className={`absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ${countBadgeClass}`}
                >
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
      <MobileNavSidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

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
              aria-label={t("nav.search")}
              aria-modal="true"
            >
              <div className="px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-6 sm:pt-6">
                <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
                  <Search className="h-5 w-5 shrink-0 text-zinc-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("nav.searchPlaceholder")}
                    className="min-w-0 flex-1 bg-transparent text-[16px] text-black placeholder:text-zinc-400 focus:outline-none sm:text-base"
                    autoFocus
                    aria-label={t("nav.searchProducts")}
                  />
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="shrink-0 rounded-full p-2 transition-colors hover:bg-zinc-100"
                    aria-label={t("nav.closeSearch")}
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
                            ? `${t("nav.results")}${filteredProducts.length > 0 ? ` (${filteredProducts.length})` : ""}`
                            : t("nav.highlights")}
                        </p>
                        {searchProductsLoading ? (
                          <p className="py-2 text-sm text-zinc-500">{t("common.loading")}</p>
                        ) : (
                          <ul className="min-w-0 space-y-0">
                            {filteredProducts.slice(0, 4).map((p) => {
                              const imgUrl = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
                              const hasDiscount = p.discount_price != null && p.discount_price < p.price;
                              const displayPrice = hasDiscount ? p.discount_price! : p.price;
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
                                      <span className="truncate">{p.name ?? t("nav.productFallback")}</span>
                                      <span className="shrink-0 text-right leading-tight">
                                        <span className="block text-xs font-semibold text-zinc-700 sm:text-sm">
                                          {formatMoney(displayPrice)}
                                        </span>
                                        {hasDiscount && (
                                          <span className="block text-[11px] text-zinc-400 line-through sm:text-xs">
                                            {formatMoney(p.price)}
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
                          <p className="py-2 text-sm text-zinc-500">{t("nav.noProducts")}</p>
                        )}
                        {!searchProductsLoading && q && filteredProducts.length === 0 && (
                          <p className="py-2 text-sm text-zinc-500">{t("nav.noSearchResults")}</p>
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
    {!isHome ? <div aria-hidden style={{ height: "var(--site-header-height, 6.5rem)" }} /> : null}
    </>
  );
}
