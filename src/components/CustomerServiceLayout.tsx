"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  CUSTOMER_SERVICE_NAV,
  getCustomerServiceLabel,
} from "@/lib/customerServiceNav";

type CustomerServiceLayoutProps = {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
};

export default function CustomerServiceLayout({
  title,
  subtitle,
  children,
}: CustomerServiceLayoutProps) {
  const pathname = usePathname();
  const currentLabel = getCustomerServiceLabel(pathname);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1200px] px-6 py-12 sm:px-8 sm:py-16 lg:px-12">
        <nav className="mb-6 text-xs text-neutral-500" aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="transition hover:text-black">
                Accueil
              </Link>
            </li>
            <li aria-hidden className="text-neutral-400">
              /
            </li>
            <li>
              <span className="text-neutral-600">Service client</span>
            </li>
            <li aria-hidden className="text-neutral-400">
              /
            </li>
            <li>
              <span className="font-medium text-neutral-800">{currentLabel}</span>
            </li>
          </ol>
        </nav>

        <h1 className="border-b border-neutral-200 pb-6 text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Service client
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          <aside>
            <nav aria-label="Service client">
              <ul className="space-y-1">
                {CUSTOMER_SERVICE_NAV.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group flex items-center justify-between gap-3 py-2.5 text-sm transition ${
                          active
                            ? "font-semibold text-black underline decoration-black underline-offset-4"
                            : "text-neutral-700 hover:text-black"
                        }`}
                      >
                        <span>{item.label}</span>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition ${
                            active
                              ? "text-neutral-800"
                              : "text-neutral-300 group-hover:text-neutral-500"
                          }`}
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0">
            <h2 className="mb-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
              {title}
            </h2>
            {subtitle ? (
              <div className="mb-8 text-sm leading-relaxed text-neutral-500">{subtitle}</div>
            ) : (
              <div className="mb-8" />
            )}
            {children}
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
