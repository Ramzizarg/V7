import { unstable_noStore as noStore } from "next/cache";
import { DashboardRecentOrders } from "@/components/DashboardRecentOrders";
import { neonQuery } from "@/lib/neon-db";
import { ShoppingCart, Package2, PiggyBank, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getDashboardData() {
  noStore();
  try {
    const ordersRes = await neonQuery<any>(
      "SELECT id, full_name, city, governorate, phone_number, email, total_price, status, created_at, confirmed_by_phone FROM orders ORDER BY created_at DESC"
    );
    const productsRes = await neonQuery<{ total: string }>("SELECT COUNT(*)::text as total FROM products");

    const ordersList = ordersRes.rows ?? [];
    const totalOrders = ordersList.length;
    const totalRevenue = ordersList.reduce((s: number, o: any) => s + Number(o.total_price ?? 0), 0);

    return {
      totalOrders,
      totalRevenue,
      productsCount: Number(productsRes.rows?.[0]?.total || 0),
      recentOrders: ordersList.slice(0, 10),
      dataMissing: false,
    };
  } catch {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      productsCount: 0,
      recentOrders: [],
      dataMissing: true,
    };
  }
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", minimumFractionDigits: 2 }).format(n);
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const stats = [
    { label: "Total orders", value: data.totalOrders, icon: ShoppingCart, bg: "bg-white", border: "border-black", text: "text-black" },
    { label: "Products", value: data.productsCount, icon: Package2, bg: "bg-white", border: "border-black", text: "text-black" },
    { label: "Total revenue", value: formatPrice(data.totalRevenue), icon: PiggyBank, bg: "bg-black", border: "border-black", text: "text-white" },
    { label: "Visitors", value: 0, icon: Users, bg: "bg-white", border: "border-black", text: "text-black" },
  ];

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
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-4 flex flex-col ${s.bg} ${s.border} ${s.text}`}>
            <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
              <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider opacity-80 truncate">{s.label}</span>
              <s.icon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 opacity-70" />
            </div>
            <span className="text-lg sm:text-xl font-bold truncate">{s.value}</span>
          </div>
        ))}
      </div>
      <DashboardRecentOrders orders={data.recentOrders} />
    </div>
  );
}
