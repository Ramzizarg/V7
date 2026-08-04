import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DashboardOnlineVisitors } from "@/components/DashboardOnlineVisitors";
import { DashboardRecentOrders } from "@/components/DashboardRecentOrders";
import { neonQuery } from "@/lib/neon-db";
import { BarChart3, Package2, PiggyBank, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getDashboardData() {
  noStore();
  try {
    const ordersRes = await neonQuery<{
      id: number;
      full_name: string;
      city: string;
      governorate: string;
      phone_number: string;
      email: string | null;
      total_price: number;
      status: string;
      created_at: string;
      confirmed_by_phone: boolean | null;
    }>(
      "SELECT id, full_name, city, governorate, phone_number, email, total_price, status, created_at, confirmed_by_phone FROM orders ORDER BY created_at DESC"
    );
    const productsRes = await neonQuery<{ total: string; in_stock: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE COALESCE(stock, 0) > 0)::text AS in_stock
       FROM products`
    );
    const itemsRes = await neonQuery<{ order_id: number; size: string | null }>(
      "SELECT order_id, size FROM order_items"
    );

    const sizesByOrder: Record<number, string[]> = {};
    for (const item of itemsRes.rows ?? []) {
      const size = typeof item.size === "string" ? item.size.trim() : "";
      if (!size) continue;
      if (!sizesByOrder[item.order_id]) sizesByOrder[item.order_id] = [];
      sizesByOrder[item.order_id].push(size);
    }

    const ordersList = (ordersRes.rows ?? []).map((o) => ({
      ...o,
      sizes_label: (sizesByOrder[o.id] ?? []).join(", ") || "—",
    }));
    const totalOrders = ordersList.length;
    const pendingOrders = ordersList.filter((o) => {
      const s = String(o.status ?? "").toLowerCase();
      return s === "pending" || s === "";
    }).length;
    const deliveredOrders = ordersList.filter((o) => {
      const s = String(o.status ?? "").toLowerCase();
      return s === "delivered";
    }).length;
    const totalRevenue = ordersList.reduce((s, o) => s + Number(o.total_price ?? 0), 0);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const revenueToday = ordersList
      .filter((o) => new Date(o.created_at) >= startOfToday)
      .reduce((s, o) => s + Number(o.total_price ?? 0), 0);

    return {
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalRevenue,
      revenueToday,
      productsCount: Number(productsRes.rows?.[0]?.total || 0),
      productsInStock: Number(productsRes.rows?.[0]?.in_stock || 0),
      recentOrders: ordersList.slice(0, 10),
      dataMissing: false,
    };
  } catch {
    return {
      totalOrders: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalRevenue: 0,
      revenueToday: 0,
      productsCount: 0,
      productsInStock: 0,
      recentOrders: [],
      dataMissing: true,
    };
  }
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
  }).format(n);
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const productsOos = Math.max(0, data.productsCount - data.productsInStock);

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-black">Dashboard</h1>
        <p className="text-sm text-zinc-600 mt-1">Welcome to your admin space.</p>
      </div>

      {data.dataMissing ? (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Base Neon connectee, mais les tables du backoffice ne sont pas encore creees (ex: orders, products).
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Orders */}
        <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white px-4 py-4 flex flex-col min-h-[7.5rem]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-zinc-500 truncate">
              Total orders
            </span>
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-zinc-700" />
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-black tabular-nums">{data.totalOrders}</span>
          <p className="mt-1 text-[11px] text-zinc-600">
            {data.pendingOrders} en attente · {data.deliveredOrders} livrées
          </p>
          <p className="pt-1 text-[10px] text-zinc-500">Suivi des commandes</p>
          <Link
            href="/dashboard/analytiques"
            className="mt-auto pt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-black transition hover:bg-zinc-50"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Voir commandes
          </Link>
        </div>

        {/* Products */}
        <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white px-4 py-4 flex flex-col min-h-[7.5rem]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-zinc-500 truncate">
              Products
            </span>
            <Package2 className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-zinc-700" />
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-black tabular-nums">{data.productsCount}</span>
          <p className="mt-1 text-[11px] text-zinc-600">
            {data.productsInStock} en stock
            {productsOos > 0 ? ` · ${productsOos} rupture` : ""}
          </p>
          <p className="pt-1 text-[10px] text-zinc-500">Catalogue boutique</p>
          <Link
            href="/dashboard/produits"
            className="mt-auto pt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-black transition hover:bg-zinc-50"
          >
            <Package2 className="h-3.5 w-3.5" />
            Gérer produits
          </Link>
        </div>

        {/* Revenue */}
        <div className="rounded-xl border border-black bg-gradient-to-br from-zinc-900 to-black px-4 py-4 flex flex-col min-h-[7.5rem] text-white">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-white/70 truncate">
              Total revenue
            </span>
            <PiggyBank className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-white/80" />
          </div>
          <span className="text-xl sm:text-2xl font-bold tabular-nums leading-tight">{formatPrice(data.totalRevenue)}</span>
          <p className="mt-1 text-[11px] text-white/75">Aujourd’hui {formatPrice(data.revenueToday)}</p>
          <p className="pt-1 text-[10px] text-white/50">Chiffre d’affaires net</p>
          <Link
            href="/dashboard/analytiques"
            className="mt-auto pt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/15"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Voir analytiques
          </Link>
        </div>

        <DashboardOnlineVisitors variant="card" />
      </div>
      <DashboardRecentOrders orders={data.recentOrders} />
    </div>
  );
}
