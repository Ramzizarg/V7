"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CartSidebar } from "@/components/shop/CartSidebar";
import { CART_SIDEBAR_OPEN_EVENT, cancelPendingCartSidebarOpen } from "@/lib/favorisUx";
import { getCartItemCount, getWishlistCount } from "@/lib/shopClientStorage";

type Active = "favoris" | "panier" | "none";

const iconBtn =
  "inline-flex items-center justify-center rounded-full p-2 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30";

type Props = {
  active?: Active;
  /**
   * Middle breadcrumb, e.g. { label: "Favoris" } with Accueil on the left.
   */
  breadcrumb?: { label: string; href?: string }[];
};

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

export function ShopHeader({ active = "none", breadcrumb }: Props) {
  const [cartCount, setCartCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);

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

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-2 sm:px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2 sm:gap-3" aria-label="Accueil Vero7">
          <Image
            src="/vero7-logo.png"
            alt="Vero7"
            width={56}
            height={56}
            className="h-10 w-auto object-contain sm:h-12"
            priority
            loading="eager"
          />
          <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 min-[400px]:inline">
            Boutique
          </span>
        </Link>

        {breadcrumb && breadcrumb.length > 0 ? (
          <nav
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-medium text-zinc-500 min-[500px]:flex sm:text-sm"
            aria-label="Fil d'Ariane"
          >
            <Link href="/" className="transition hover:opacity-70">
              Accueil
            </Link>
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-zinc-300">/</span>
                {b.href ? (
                  <Link href={b.href} className="text-black transition hover:opacity-70">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-black">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <Link
            id="site-header-favoris"
            href="/favoris"
            className={`${iconBtn} relative isolate`}
            aria-label={favCount > 0 ? `Favoris, ${favCount} article${favCount > 1 ? "s" : ""}` : "Favoris"}
            aria-current={active === "favoris" ? "page" : undefined}
          >
            <HeartIcon className="h-5 w-5" filled={active === "favoris"} />
            {favCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                {favCount}
              </span>
            ) : null}
          </Link>
          <button
            className={`${iconBtn} relative isolate`}
            aria-label="Panier"
            aria-current={active === "panier" ? "page" : undefined}
            type="button"
            onClick={() => setCartSidebarOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 7h12l-1 11H7L6 7Zm3 0a3 3 0 1 1 6 0"
                className={active === "panier" ? "text-black" : ""}
              />
            </svg>
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                {cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
      <CartSidebar open={cartSidebarOpen} onClose={() => setCartSidebarOpen(false)} />
    </header>
  );
}
