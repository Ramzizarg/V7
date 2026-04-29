"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import type { StorefrontCategory } from "@/lib/types";

/** Accueil si la table `categories` est vide ou indisponible. */
const CAROUSEL_STATIC_FALLBACK: StorefrontCategory[] = [
  { id: 0, name: "Hoodies", slug: "hoodies", sort_order: 0, image: "/V7/2.jpeg" },
  { id: 0, name: "T-shirts", slug: "t-shirts", sort_order: 0, image: "/V7/3.jpeg" },
  { id: 0, name: "Shorts", slug: "shorts", sort_order: 0, image: "/V7/4.jpeg" },
  { id: 0, name: "Joggers", slug: "joggers", sort_order: 0, image: "/V7/1.jpg" },
];

export default function Home() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const [dbCategories, setDbCategories] = useState<StorefrontCategory[]>([]);

  const featuredItems = [
    { id: "f1", src: "/V7/2.jpeg", alt: "Maillot jersey rouge" },
    { id: "f2", src: "/V7/3.jpeg", alt: "Maillot jersey bordeaux" },
    { id: "f3", src: "/V7/4.jpeg", alt: "Maillot jersey raye" },
    { id: "f4", src: "/V7/1.jpg", alt: "Maillot jersey lifestyle" },
    { id: "f5", src: "/V7/img-1.jpg", alt: "Maillots duo lifestyle" },
    { id: "f6", src: "/V7/2.jpeg", alt: "Maillot jersey rouge" },
    { id: "f7", src: "/V7/3.jpeg", alt: "Maillot jersey bordeaux" },
  ];

  const scrollFeatured = (dir: "prev" | "next") => {
    const el = featuredRef.current;
    if (!el) return;
    const step = typeof window !== "undefined" && window.innerWidth < 640 ? 216 : 248;
    el.scrollBy({ left: dir === "prev" ? -step * 2 : step * 2, behavior: "smooth" });
  };

  const carouselCategories = dbCategories.length > 0 ? dbCategories : CAROUSEL_STATIC_FALLBACK;

  const scrollCarousel = (dir: "prev" | "next") => {
    const el = carouselRef.current;
    if (!el) return;
    const step = typeof window !== "undefined" && window.innerWidth < 640 ? 260 : 320;
    el.scrollBy({ left: dir === "prev" ? -step : step, behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { categories?: StorefrontCategory[] }) => {
        if (!cancelled) setDbCategories(Array.isArray(d.categories) ? d.categories : []);
      })
      .catch(() => {
        if (!cancelled) setDbCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const centerCarousel = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max > 0) {
        el.scrollLeft = max / 2;
      }
    };

    const frame = requestAnimationFrame(centerCarousel);
    window.addEventListener("resize", centerCarousel);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", centerCarousel);
    };
  }, [carouselCategories.length]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <main>
        <section className="hero-fade grid-overlay relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('/hero-img.jpg')",
              backgroundPosition: "center 30%",
            }}
          />
          <div className="absolute inset-0 bg-white/20" />
          <div className="relative z-10 flex min-h-[560px] w-full flex-col justify-end px-5 py-14 sm:px-8 sm:py-16 lg:min-h-[640px] lg:px-10 lg:py-20">
            <span className="mb-5 inline-block h-[2px] w-20 bg-white/90" />
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
              Collection Sport x Casual
            </p>
            <h1 className="max-w-3xl text-5xl font-extrabold uppercase leading-[0.95] text-white sm:text-6xl lg:text-7xl">
              Renverse Les Regles
            </h1>
            <p className="mt-4 max-w-xl text-2xl text-white/95 sm:text-3xl">
              Signe par Vero7.
            </p>
          </div>
        </section>

        <section id="categories" className="w-full py-14">
          <div className="mb-5 w-full px-3 sm:px-4">
            <h2 className="text-left text-2xl font-black uppercase tracking-[0.02em] text-black sm:text-3xl">
              Acheter par Categorie
            </h2>
          </div>
          <div className="relative">
            <button
              onClick={() => scrollCarousel("prev")}
              aria-label="Defiler a gauche"
              className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black shadow transition hover:bg-white"
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
              onClick={() => scrollCarousel("next")}
              aria-label="Defiler a droite"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black shadow transition hover:bg-white"
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
              ref={carouselRef}
              className="overflow-x-auto overflow-y-hidden w-full px-1 sm:px-2 no-scrollbar"
            >
              <div
                className="flex gap-2"
                style={{
                  animationName: "categories-inline-scroll",
                  animationDuration: "28s",
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationPlayState: "running",
                  width: "max-content",
                }}
              >
                {Array.from({ length: 8 }, (_, copy) => (
                  <div key={copy} className="flex gap-2" aria-hidden={copy > 0}>
                    {carouselCategories.map((item) => (
                      <a
                        key={`${copy}-${item.slug}-${item.id}`}
                        href="/collection"
                        className="group relative block h-[320px] w-[280px] shrink-0 overflow-hidden rounded-sm border border-black/10"
                      >
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                          style={{ backgroundImage: `url(${item.image})` }}
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
          </div>
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
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 border border-black/10 bg-white p-2.5 text-black shadow-md transition hover:bg-zinc-50 sm:left-4"
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
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 border border-black/10 bg-white p-2.5 text-black shadow-md transition hover:bg-zinc-50 sm:right-4"
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
              className="no-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden px-12 py-1 sm:gap-2.5 sm:px-16"
            >
              {[0, 1].map((copy) =>
                featuredItems.map((item, itemIdx) => {
                  const isFirstFeatured = copy === 0 && itemIdx === 0;
                  return (
                    <a
                      key={`${copy}-${item.id}`}
                      href="/collection"
                      className="group relative flex h-[260px] w-[200px] shrink-0 flex-col items-center justify-center bg-[#e8e8e8] sm:h-[280px] sm:w-[228px]"
                    >
                      <div className="relative h-[200px] w-[160px] sm:h-[220px] sm:w-[180px]">
                        <Image
                          src={item.src}
                          alt={item.alt}
                          fill
                          priority={isFirstFeatured}
                          loading={isFirstFeatured ? "eager" : "lazy"}
                          fetchPriority={isFirstFeatured ? "high" : "auto"}
                          sizes="(max-width: 640px) 160px, 180px"
                          className="object-contain object-center transition duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section id="club" className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <div className="border border-black/10 bg-white p-4 sm:p-6">
            <h2 className="text-3xl font-black uppercase leading-none text-black sm:text-4xl">
              Join The Club -15% Off First Order
            </h2>
            <p className="mt-3 max-w-xl text-base text-zinc-700">
              Get inspired and enjoy member-only advantages. Join the club and
              unlock exclusive benefits on your first purchase.
            </p>
            <a
              href="#shop"
              className="mt-5 inline-flex bg-[#122a74] px-7 py-3 text-xl font-bold text-white transition hover:bg-[#0e215d]"
            >
              Join Now
            </a>

            <div className="mt-8 grid grid-cols-1 gap-4 text-black sm:grid-cols-2">
              {[
                "15% OFF YOUR FIRST ORDER",
                "BIRTHDAY GIFT",
                "FREE RETURN",
                "PRODUCT PREVIEW",
                "SPECIAL OFFERS",
                "WEEKLY NEWSLETTER",
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
                alt="Vero7 club members"
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
