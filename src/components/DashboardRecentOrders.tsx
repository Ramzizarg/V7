"use client";

type OrderRow = {
  id: number;
  full_name: string;
  city: string;
  governorate: string;
  total_price: number;
  status: string;
  created_at: string;
  sizes_label?: string;
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", minimumFractionDigits: 2 }).format(n);
}

function statusLabel(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (s === "pending") return "Pending";
  if (s === "confirmed") return "Confirmed";
  if (s === "rejected") return "Rejected";
  if (s === "out_for_delivery" || s === "shipped") return "Out for delivery";
  if (s === "delivered") return "Delivered";
  return status || "—";
}

function statusClass(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (s === "pending") return "bg-amber-100 text-amber-800";
  if (s === "confirmed") return "bg-violet-100 text-violet-800";
  if (s === "rejected") return "bg-red-100 text-red-800";
  if (s === "out_for_delivery" || s === "shipped") return "bg-blue-100 text-blue-800";
  if (s === "delivered") return "bg-emerald-100 text-emerald-800";
  return "bg-zinc-100 text-zinc-700";
}

export function DashboardRecentOrders({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
        <h2 className="text-base sm:text-lg font-bold text-black uppercase tracking-wider">Recent orders</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-4 py-3 text-left">Order</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Ville</th>
              <th className="px-4 py-3 text-left">Taille</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-zinc-100">
                <td className="px-4 py-3 font-mono">#{o.id}</td>
                <td className="px-4 py-3">{o.full_name}</td>
                <td className="px-4 py-3">{o.city}, {o.governorate}</td>
                <td className="px-4 py-3 font-medium text-zinc-700">{o.sizes_label ?? "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatPrice(Number(o.total_price))}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(o.status)}`}>
                    {statusLabel(o.status)}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>No orders yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
