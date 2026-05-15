"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { ComingSoonPlaceholder } from "@/components/ComingSoonPlaceholder";
import { isProductOutOfStock } from "@/lib/productSizesDisplay";
import { isProductListedForSale } from "@/lib/productListing";
import { productPathSlug } from "@/lib/productUrl";
import { getCachedHomeContentSync, getHomeContent } from "@/lib/homeContent";
import type { HomeContent } from "@/lib/homeContent";
import type { Product, StorefrontCategory } from "@/lib/types";

/** Hero fallback images (si backoffice n'a rien configuré). */
const HERO_FALLBACK_IMAGES = ["/V7/img.jpg", "/V7/imgg.png", "/V7/imggg.png", "/V7/imgggg.png"] as const;
const HERO_SLIDE_MS = 5000;

/** Accueil si la table `categories` est vide ou indisponible (fichiers presents dans `public/` pour affichage immediat). */
const CAROUSEL_STATIC_FALLBACK: StorefrontCategory[] = [
  { id: 0, name: "Hoodies", slug: "hoodies", sort_order: 0, image: "/globe.svg" },
  { id: 0, name: "T-shirts", slug: "t-shirts", sort_order: 0, image: "/next.svg" },
  { id: 0, name: "Shorts", slug: "shorts", sort_order: 0, image: "/vercel.svg" },
  { id: 0, name: "Joggers", slug: "joggers", sort_order: 0, image: "/window.svg" },
];

export default function Home() {
  const featuredRef = useRef<HTMLDivElement>(null);
  const [heroSlide, setHeroSlide] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [homeContent, setHomeContent] = useState<HomeContent | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [homeContentLoaded, setHomeContentLoaded] = useState(false);
  const [dbCategories, setDbCategories] = useState<StorefrontCategory[]>([]);
  /** `undefined` = not loaded yet; then API products or empty. */
  const [collectionProducts, setCollectionProducts] = useState<Product[] | undefined>(undefined);

  const featuredFallback = [
    { id: "f1", src: "/V7/2.jpeg", alt: "Maillot jersey rouge" },
    { id: "f2", src: "/V7/3.jpeg", alt: "Maillot jersey bordeaux" },
    { id: "f3", src: "/V7/4.jpeg", alt: "Maillot jersey raye" },
    { id: "f4", src: "/V7/1.jpg", alt: "Maillot jersey lifestyle" },
    { id: "f5", src: "/V7/img-1.jpg", alt: "Maillots duo lifestyle" },
    { id: "f6", src: "/V7/2.jpeg", alt: "Maillot jersey rouge" },
    { id: "f7", src: "/V7/3.jpeg", alt: "Maillot jersey bordeaux" },
  ] as const;

  const featuredVedettes = useMemo(() => {
    const hexOk = (h: string | null | undefined) =>
      typeof h === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(h);
    const mapProduct = (p: Product) => {
      const list =
        p.discount_price != null && p.discount_price < p.price ? p.price : null;
      const sale =
        p.discount_price != null && p.discount_price < p.price
          ? p.discount_price
          : p.price;
      const discountPercent =
        list != null && list > 0 ? Math.max(1, Math.round(((list - sale) / list) * 100)) : null;
      const colors: { label: string; hex: string | null }[] = [];
      if (p.color?.trim()) {
        const h = p.color_hex;
        colors.push({ label: p.color.trim(), hex: h && hexOk(h) ? h : null });
      }
      if (p.color_2?.trim()) {
        const h2 = p.color_2_hex;
        colors.push({ label: p.color_2.trim(), hex: h2 && hexOk(h2) ? h2 : null });
      }
      return {
        key: `db-${p.id}`,
        href: `/collection/${encodeURIComponent(productPathSlug(p))}` as const,
        src: p.images[0] || "/V7/1.jpg",
        alt: p.name,
        name: p.name,
        listPrice: list,
        price: sale,
        discountPercent,
        colors,
        oos: isProductOutOfStock({ sizes: p.sizes, stock: p.stock }),
        comingSoon: !isProductListedForSale(p),
      };
    };
    // Evite le "double rendu" au reload:
    // tant que l'API n'a pas repondu, on n'affiche pas encore la liste fallback.
    if (collectionProducts === undefined) {
      return [];
    }
    if (collectionProducts.length > 0) {
      return collectionProducts.slice(0, 12).map(mapProduct);
    }
    const fallbackColors: { label: string; hex: string | null }[][] = [
      [{ label: "Rouge", hex: "#9f1239" }, { label: "Marine", hex: "#1e3a5f" }],
      [{ label: "Bordeaux", hex: "#7c2d12" }, { label: "Blanc", hex: "#f4f4f5" }],
      [{ label: "Noir", hex: "#1c1917" }],
      [{ label: "Rouge", hex: "#b91c1c" }, { label: "Blanc", hex: "#fafafa" }],
      [{ label: "Rayé", hex: null }],
      [{ label: "Rouge", hex: "#9f1239" }, { label: "Marine", hex: "#1e3a5f" }],
      [{ label: "Bordeaux", hex: "#7c2d12" }],
    ];
    return featuredFallback.map((item, i) => {
      const onSale = i % 2 === 0;
      const list = onSale ? 120 : null;
      const price = onSale ? 89 - (i % 3) : 72 + (i * 4) % 28;
      return {
        key: item.id,
        href: "/collection" as const,
        src: item.src,
        alt: item.alt,
        name: item.alt,
        listPrice: list,
        price,
        discountPercent:
          onSale && list != null ? Math.max(1, Math.round(((list - price) / list) * 100)) : null,
        colors: fallbackColors[i] ?? [{ label: "—", hex: null }],
        oos: false,
        comingSoon: false,
      };
    });
  }, [collectionProducts]);

  const scrollFeatured = (dir: "prev" | "next") => {
    const el = featuredRef.current;
    if (!el) return;
    const step = typeof window !== "undefined" && window.innerWidth < 640 ? 216 : 248;
    el.scrollBy({ left: dir === "prev" ? -step * 2 : step * 2, behavior: "smooth" });
  };

  const carouselCategories = dbCategories.length > 0 ? dbCategories : CAROUSEL_STATIC_FALLBACK;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { categories?: StorefrontCategory[]; products?: Product[] }) => {
        if (cancelled) return;
        setDbCategories(Array.isArray(d.categories) ? d.categories : []);
        setCollectionProducts(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => {
        if (!cancelled) {
          setDbCategories([]);
          setCollectionProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHydrated(true);
    const cached = getCachedHomeContentSync();
    if (cached) setHomeContent(cached);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getHomeContent()
      .then((c) => {
        if (cancelled) return;
        setHomeContent(c);
      })
      .catch(() => {
        if (!cancelled) setHomeContent(null);
      })
      .finally(() => {
        if (!cancelled) setHomeContentLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const heroImages = useMemo(() => {
    if (!hydrated || !homeContentLoaded) return [];
    const list =
      (homeContent?.heroImageUrls ?? []).filter((x) => typeof x === "string" && x.trim().length > 0) ?? [];
    return list.length ? list : [...HERO_FALLBACK_IMAGES];
  }, [hydrated, homeContentLoaded, homeContent]);

  const heroCollectionText = homeContent?.heroCollection || "Collection Sport x Casual";
  const heroHeadlineText = homeContent?.heroHeadline || "Renverse Les Regles";
  const heroDescriptionText = homeContent?.heroDescription || "Signe par Vero7.";
  const heroImagePositionMobile =
    typeof homeContent?.heroImagePositionMobile === "number" ? homeContent.heroImagePositionMobile : 50;

  const heroCollectionColor = homeContent?.heroCollectionColor || "#ffffff";
  const heroHeadlineColor = homeContent?.heroHeadlineColor || "#ffffff";
  const heroDescriptionColor = homeContent?.heroDescriptionColor || "#999999";
  const hasFeaturedVedettes = featuredVedettes.length > 0;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    // Reset index when the hero image list changes.
    setHeroSlide(0);

    if (heroImages.length < 2) return;
    const id = window.setInterval(() => {
      setHeroSlide((i) => (i + 1) % heroImages.length);
    }, HERO_SLIDE_MS);
    return () => window.clearInterval(id);
  }, [heroImages.length]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <main>
        <section className="hero-fade grid-overlay relative overflow-hidden">
          <div className="absolute inset-0" aria-hidden>
            {heroImages.map((src, i) => (
              <div
                key={src}
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-out"
                style={{
                  backgroundImage: `url('${src}')`,
                  backgroundPosition: isMobileViewport
                    ? `${heroImagePositionMobile}% center`
                    : "center 30%",
                  opacity: heroSlide === i ? 1 : 0,
                }}
              />
            ))}
          </div>
          <div className="relative z-10 flex min-h-[560px] w-full flex-col justify-end px-5 py-14 sm:px-8 sm:py-16 lg:min-h-[640px] lg:px-10 lg:py-20">
            <span className="mb-5 inline-block h-[2px] w-20 bg-white/90" />
            <p
              className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85"
              style={{ color: heroCollectionColor }}
            >
              {heroCollectionText}
            </p>
            <h1
              className="max-w-3xl text-5xl font-extrabold uppercase leading-[0.95] sm:text-6xl lg:text-7xl whitespace-pre-line"
              style={{ color: heroHeadlineColor }}
            >
              {heroHeadlineText}
            </h1>
            <p
              className="mt-4 max-w-xl text-2xl sm:text-3xl"
              style={{ color: heroDescriptionColor }}
            >
              {heroDescriptionText}
            </p>
            {heroImages.length > 0 ? (
              <div
                className="mt-6 flex w-full max-w-[160px] gap-1 sm:max-w-[200px]"
                role="status"
                aria-label={`Image hero ${heroSlide + 1} sur ${heroImages.length}`}
              >
                {heroImages.map((_, i) => {
                  const done = i < heroSlide;
                  const current = i === heroSlide;
                  return (
                    <div
                      key={i}
                      className="h-1 min-h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"
                    >
                      {done ? (
                        <div className="h-full w-full rounded-full bg-white" />
                      ) : null}
                      {current ? (
                        <div
                          key={heroSlide}
                          className="h-full w-full origin-left rounded-full bg-white"
                          style={{
                            animation: `hero-slide-progress ${HERO_SLIDE_MS}ms linear forwards`,
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section id="categories" className="w-full py-14">
          <div className="mb-5 w-full px-3 sm:px-4">
            <h2 className="text-left text-2xl font-black uppercase tracking-[0.02em] text-black sm:text-3xl">
              Acheter par Categorie
            </h2>
          </div>
          {carouselCategories.length > 0 ? (
            <div className="categories-marquee px-1 sm:px-2">
              <div className="categories-loop-track gap-2">
                {Array.from({ length: 2 }, (_, copy) => (
                  <div key={copy} className="flex gap-2" aria-hidden={copy > 0}>
                    {carouselCategories.map((item) => (
                      <a
                        key={`${copy}-${item.slug}-${item.id}`}
                        href="/collection"
                        className="group relative block h-[320px] w-[280px] shrink-0 overflow-hidden rounded-sm border border-black/10"
                      >
                        <div
                          className={`absolute inset-0 bg-center transition duration-500 group-hover:scale-105 ${
                            item.image.endsWith(".svg") ? "bg-contain bg-no-repeat" : "bg-cover"
                          }`}
                          style={{ backgroundImage: `url('${item.image}')` }}
                        />
                        <div className="absolute inset-0 bg-black/22" />
                        <div className="relative z-10 flex h-full items-end p-4">
                          <h3 className="text-4xl font-extrabold uppercase tracking-[0.06em] text-white">
                            {item.name}
                          </h3>
                        </div>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="relative w-full overflow-hidden">
          <div
            className="relative min-h-[220px] w-full bg-no-repeat sm:min-h-[250px] lg:min-h-[280px]"
            style={{
              backgroundImage: "url('/V7/img-2.jpeg')",
              backgroundPosition: "center 20%",
              backgroundSize: "100% auto",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-black/15" />
            <div className="relative z-10 flex min-h-[240px] w-full flex-col justify-end px-6 py-5 sm:min-h-[280px] sm:px-8 sm:py-6 lg:min-h-[320px] lg:px-10">
              <div className="flex w-full items-end justify-between gap-5">
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none text-white sm:text-5xl">
                    Absorption des Chocs
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-white/90 sm:text-base">
                    Brassieres a absorption des chocs pour reduire les mouvements et rester concentree a chaque entrainement.
                  </p>
                </div>
                <a
                  href="/collection"
                  className="shrink-0 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-black transition hover:bg-zinc-100"
                >
                  Acheter
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="shop" className="w-full bg-white py-10 sm:py-14">
          <div className="mb-6 w-full px-5 sm:px-8">
            <h2 className="text-left text-2xl font-black uppercase tracking-[0.02em] text-black sm:text-3xl">
              Produits Vedettes
            </h2>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollFeatured("prev")}
              aria-label="Produits precedents"
              disabled={!hasFeaturedVedettes}
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 border border-black/10 bg-white p-2.5 text-black shadow-md transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:left-4"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="m15 18-6-6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollFeatured("next")}
              aria-label="Produits suivants"
              disabled={!hasFeaturedVedettes}
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 border border-black/10 bg-white p-2.5 text-black shadow-md transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:right-4"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="m9 18 6-6-6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              ref={featuredRef}
              className="no-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden pl-0 pr-12 py-1 sm:gap-2.5 sm:pl-0 sm:pr-16"
            >
              {[0, 1].map((copy) =>
                featuredVedettes.map((item, itemIdx) => {
                  const isFirstFeatured = copy === 0 && itemIdx === 0;
                  const isRemote = item.src.startsWith("http");
                  const shellClass =
                    "group flex w-[200px] shrink-0 flex-col overflow-hidden border border-zinc-200/80 bg-white shadow-sm transition duration-200 hover:shadow-md sm:w-[240px]";
                  const featuredInner = item.comingSoon ? (
                    <ComingSoonPlaceholder compact imageUrl={item.src} />
                  ) : (
                    <>
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100">
                        <Image
                          src={item.src}
                          alt={item.alt}
                          fill
                          priority={isFirstFeatured}
                          loading={isFirstFeatured ? "eager" : "lazy"}
                          fetchPriority={isFirstFeatured ? "high" : "auto"}
                          unoptimized={isRemote}
                          sizes="(max-width: 640px) 200px, 240px"
                          className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
                        />
                        {item.oos ? (
                          <div
                            className="pointer-events-none absolute right-1.5 top-1.5 z-10 sm:right-2 sm:top-2"
                            role="status"
                          >
                            <span className="inline-block whitespace-nowrap rounded-md bg-red-600 px-1.5 py-1 text-center text-[8px] font-bold uppercase leading-tight tracking-wide text-white shadow-md sm:px-2 sm:py-1.5 sm:text-[10px] sm:tracking-wider">
                              Rupture de stock
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 border-t border-zinc-100 px-2.5 pb-3 pt-2.5 text-left">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 min-h-0 flex-1 text-xs font-medium leading-snug text-black sm:text-[13px]">
                            {item.name}
                          </h3>
                          {item.discountPercent != null && item.discountPercent > 0 ? (
                            <span className="shrink-0 text-xs font-bold text-red-600">
                              -{item.discountPercent}%
                            </span>
                          ) : null}
                        </div>
                        <p className="flex min-h-[1.25rem] items-baseline justify-between gap-2 text-sm">
                          {item.listPrice != null ? (
                            <span className="whitespace-nowrap text-zinc-400 line-through tabular-nums">
                              {item.listPrice.toFixed(2)} DT
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="ml-auto font-semibold tabular-nums text-black">
                            {item.price.toFixed(2)} DT
                          </span>
                        </p>
                        {item.oos ? (
                          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-red-600 sm:text-[11px]">
                            Rupture de stock
                          </p>
                        ) : null}
                        {item.colors.length > 0 ? (
                          <div
                            className="flex flex-wrap items-center gap-1 pt-0.5"
                            aria-label="Options de couleur"
                          >
                            {item.colors.map((c, idx) => (
                              <span
                                key={`${item.key}-swatch-${idx}`}
                                className="inline-block h-4 w-4 shrink-0 rounded-sm border border-black/20"
                                style={
                                  c.hex
                                    ? { backgroundColor: c.hex }
                                    : {
                                        background:
                                          "linear-gradient(to bottom right, rgb(244 244 245), rgb(212 212 216))",
                                      }
                                }
                                title={c.label}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </>
                  );
                  return item.comingSoon ? (
                    <div
                      key={`${copy}-${item.key}`}
                      className={`${shellClass} cursor-default select-none`}
                      role="group"
                      aria-label="Produit à venir — bientôt disponible"
                    >
                      {featuredInner}
                    </div>
                  ) : (
                    <Link key={`${copy}-${item.key}`} href={item.href} className={shellClass}>
                      {featuredInner}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section id="club" className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <div className="border border-black/10 bg-white p-4 sm:p-6">
            <h2 className="text-3xl font-black uppercase leading-none text-black sm:text-4xl">
              Rejoignez le club — 10 % sur la première commande
            </h2>
            <p className="mt-3 max-w-xl text-base text-zinc-700">
              Inspirez-vous et profitez d’avantages réservés aux membres. Rejoignez le
              club et débloquez des bénéfices exclusifs dès votre premier achat.
            </p>
            <a
              href="#shop"
              className="mt-5 inline-flex bg-[#122a74] px-7 py-3 text-xl font-bold text-white transition hover:bg-[#0e215d]"
            >
              Rejoindre
            </a>

            <div className="mt-8 grid grid-cols-1 gap-4 text-black sm:grid-cols-2">
              {[
                "10 % sur votre première commande",
                "Cadeau d’anniversaire",
                "Retour gratuit",
                "Aperçu produits",
                "Offres spéciales",
                "Newsletter hebdomadaire",
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 text-lg font-semibold uppercase">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/30 text-xs">
                    *
                  </span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-hidden">
              <Image
                src="/V7/img-1.jpg"
                alt="Membres du club Vero7"
                width={1200}
                height={700}
                className="h-auto w-full object-cover"
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
