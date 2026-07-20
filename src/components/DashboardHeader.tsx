"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, Package, Home, Globe, LogOut } from "lucide-react";

export function DashboardHeader() {
  const pathname = usePathname();
  const linkClass = (active: boolean) =>
    `font-medium flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${active ? "text-white bg-white/10" : "text-zinc-400 hover:text-white hover:bg-white/5"}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-black text-white border-b border-white/10">
      <div className="max-w-6xl mx-auto grid grid-cols-3 items-center py-3 sm:py-4 px-4 sm:px-6">
        <nav className="flex items-center gap-1 text-xs tracking-[0.12em] uppercase justify-end">
          <Link href="/dashboard" className={linkClass(pathname === "/dashboard")}> <LayoutDashboard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Dashboard</span> </Link>
          <Link href="/dashboard/analytiques" className={linkClass(pathname === "/dashboard/analytiques")}> <BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Analytiques</span> </Link>
          <Link href="/dashboard/produits" className={linkClass(pathname === "/dashboard/produits")}> <Package className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Produits</span> </Link>
        </nav>
        <div className="flex justify-center">
          <Link href="/dashboard" className="block rounded">
            <Image
              src="/vero7-logo.webp"
              alt="Vero7"
              width={64}
              height={64}
              className="h-11 w-auto"
              priority
              loading="eager"
            />
          </Link>
        </div>
        <nav className="flex items-center gap-1 text-xs tracking-[0.12em] uppercase justify-start">
          <Link href="/dashboard/home" className={linkClass(pathname === "/dashboard/home")}> <Home className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Home</span> </Link>
          <Link href="/" className={linkClass(false)}> <Globe className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Site</span> </Link>
          <form action="/api/backoffice/logout" method="post">
            <button type="submit" className={linkClass(false)} aria-label="Logout">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
