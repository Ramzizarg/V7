"use client";

import { useEffect, useState, Fragment, useMemo } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import {
  ShoppingCart,
  PiggyBank,
  Clock,
  CheckCircle,
  Truck,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  X,
} from "lucide-react";

type OrderRow = {
  id: number;
  full_name: string;
  email: string | null;
  phone_number: string;
  city: string;
  governorate: string;
  total_price: number;
  status: string;
  created_at: string;
  confirmed_by_phone?: boolean;
  items_count?: number;
};

type StatusFilter = "all" | "pending" | "rejected" | "delivered" | "out_for_delivery";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
] as const;

type EditableStatus = (typeof STATUS_OPTIONS)[number]["value"];

type OrderItemRow = {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  color: string | null;
  size: string | null;
  image_url: string | null;
};

function formatOrderItemLabel(item: Pick<OrderItemRow, "product_name" | "quantity" | "color" | "size">) {
  const details = [
    item.size?.trim() ? `Taille ${item.size.trim()}` : null,
    item.color?.trim() || null,
  ].filter(Boolean);
  return details.length
    ? `${item.product_name} — ${details.join(" · ")} × ${item.quantity}`
    : `${item.product_name} × ${item.quantity}`;
}

function formatOrderSizes(items: OrderItemRow[] | undefined): string {
  if (!items?.length) return "—";
  const sizes = items
    .map((item) => item.size?.trim())
    .filter((size): size is string => Boolean(size));
  if (sizes.length === 0) return "—";
  return sizes.join(", ");
}

function normalizeStatus(status: string): EditableStatus {
  const s = status?.toLowerCase();
  if (s === "confirmed" || s === "delivered") return "delivered";
  if (s === "shipped" || s === "out_for_delivery") return "out_for_delivery";
  if (s === "rejected") return "rejected";
  return "pending";
}

export default function DashboardAnalytiquesPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingPhoneId, setSavingPhoneId] = useState<number | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<Record<number, OrderItemRow[]>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const getStatusStyle = (status: string) => {
    const s = normalizeStatus(status);
    if (s === "rejected") return "bg-red-100 text-red-800";
    if (s === "delivered") return "bg-emerald-100 text-emerald-800";
    if (s === "pending") return "bg-amber-100 text-amber-800";
    if (s === "out_for_delivery") return "bg-blue-100 text-blue-800";
    return "bg-zinc-100 text-zinc-700";
  };
  const patchOrder = (orderId: number, patch: Partial<OrderRow>) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)));
  };

  const handlePhoneConfirm = async (order: OrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.confirmed_by_phone || savingPhoneId === order.id) return;

    setSavingPhoneId(order.id);
    setError(null);
    const previous = order.confirmed_by_phone;
    patchOrder(order.id, { confirmed_by_phone: true });

    try {
      const supabase = supabaseBrowserClient();
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ confirmed_by_phone: true })
        .eq("id", order.id);
      if (updateErr) throw updateErr;
    } catch (err) {
      patchOrder(order.id, { confirmed_by_phone: previous });
      setError(err instanceof Error ? err.message : "Impossible de confirmer le téléphone.");
    } finally {
      setSavingPhoneId(null);
    }
  };

  const handleStatusChange = async (order: OrderRow, nextStatus: EditableStatus, e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (normalizeStatus(order.status) === nextStatus || savingStatusId === order.id) return;

    setSavingStatusId(order.id);
    setError(null);
    const previous = order.status;
    patchOrder(order.id, { status: nextStatus });

    try {
      const supabase = supabaseBrowserClient();
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", order.id);
      if (updateErr) throw updateErr;
    } catch (err) {
      patchOrder(order.id, { status: previous });
      setError(err instanceof Error ? err.message : "Impossible de changer le statut.");
    } finally {
      setSavingStatusId(null);
    }
  };

  const renderPhoneConfirm = (order: OrderRow, compact = false) => {
    const confirmed = Boolean(order.confirmed_by_phone);
    const saving = savingPhoneId === order.id;

    if (confirmed) {
      return (
        <span
          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 ${
            compact ? "text-[10px] px-2 py-0.5" : ""
          }`}
        >
          Oui
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => handlePhoneConfirm(order, e)}
        disabled={saving}
        title="Cliquer pour confirmer par téléphone"
        className={`inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60 ${
          compact ? "text-[10px] px-2 py-0.5" : ""
        }`}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Non
      </button>
    );
  };

  const renderStatusSelect = (order: OrderRow, compact = false) => {
    const current = normalizeStatus(order.status);
    const saving = savingStatusId === order.id;

    return (
      <select
        value={current}
        disabled={saving}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => handleStatusChange(order, e.target.value as EditableStatus, e)}
        className={`rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-semibold uppercase cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-60 ${getStatusStyle(
          current
        )} ${compact ? "text-[10px] py-0.5" : ""}`}
        aria-label={`Statut commande #${order.id}`}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = supabaseBrowserClient();
        const { data: ordersData, error: ordersErr } = await supabase
          .from("orders")
          .select("id, full_name, email, phone_number, city, governorate, total_price, status, created_at, confirmed_by_phone")
          .order("created_at", { ascending: false });
        if (ordersErr) throw ordersErr;
        const ordersList = (ordersData ?? []) as OrderRow[];

        const { data: itemsData, error: itemsErr } = await supabase
          .from("order_items")
          .select("order_id, product_id, product_name, quantity, price, color, size");
        if (itemsErr) throw itemsErr;
        const items = (itemsData ?? []) as {
          order_id: number;
          product_id: number;
          product_name: string;
          quantity: number;
          price: number;
          color: string | null;
          size: string | null;
        }[];

        const productIds = [...new Set(items.map((i) => i.product_id))];
        const { data: productsData } = await supabase
          .from("products")
          .select("id, images")
          .in("id", productIds);
        const products = (productsData ?? []) as { id: number; images: string[] }[];
        const imageByProductId: Record<number, string | null> = {};
        for (const p of products) {
          const imgs = Array.isArray(p.images) ? p.images : [];
          imageByProductId[p.id] = imgs[0] ?? null;
        }

        const countByOrder: Record<number, number> = {};
        const itemsByOrder: Record<number, OrderItemRow[]> = {};
        for (const item of items) {
          countByOrder[item.order_id] = (countByOrder[item.order_id] ?? 0) + item.quantity;
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
          itemsByOrder[item.order_id].push({
            ...item,
            image_url: imageByProductId[item.product_id] ?? null,
          });
        }
        for (const o of ordersList) {
          o.items_count = countByOrder[o.id] ?? 0;
        }
        setOrders(ordersList);
        setOrderItems(itemsByOrder);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", minimumFractionDigits: 2 }).format(n);
  const formatDate = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatDateShort = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_price), 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const rejected = orders.filter((o) => o.status === "rejected").length;
  const delivered = orders.filter((o) => o.status === "delivered" || o.status === "confirmed").length;
  const outForDelivery = orders.filter((o) => o.status === "out_for_delivery" || o.status === "shipped").length;

  const ordersThisWeek = orders.filter((o) => new Date(o.created_at) >= startOfWeek);
  const revenueThisWeek = ordersThisWeek.reduce((s, o) => s + Number(o.total_price), 0);
  const ordersThisMonth = orders.filter((o) => new Date(o.created_at) >= startOfMonth);
  const revenueThisMonth = ordersThisMonth.reduce((s, o) => s + Number(o.total_price), 0);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    if (statusFilter === "delivered") return orders.filter((o) => o.status === "delivered" || o.status === "confirmed");
    if (statusFilter === "out_for_delivery") return orders.filter((o) => o.status === "out_for_delivery" || o.status === "shipped");
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const stats = [
    { label: "Total orders", value: totalOrders, icon: ShoppingCart, bg: "bg-white", border: "border-black", text: "text-black" },
    { label: "Total revenue", value: formatPrice(totalRevenue), icon: PiggyBank, bg: "bg-black", border: "border-black", text: "text-white" },
    { label: "Pending", value: pending, icon: Clock, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
    { label: "Rejected", value: rejected, icon: X, bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
    { label: "Delivered", value: delivered, icon: CheckCircle, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
    { label: "Out for delivery", value: outForDelivery, icon: Truck, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
  ];

  const style = { fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-20" style={style}>
        <p className="text-sm text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      </div>
    );
  }

  const filterLabels: Record<StatusFilter, string> = {
    all: "All",
    pending: "Pending",
    rejected: "Rejected",
    delivered: "Delivered",
    out_for_delivery: "Shipped",
  };

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0" style={style}>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-black">Analytiques</h1>
        <p className="text-sm text-zinc-600 mt-1">Orders & statistics</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-4 py-4 flex flex-col ${s.bg} ${s.border} ${s.text}`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
              <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider opacity-80 truncate">{s.label}</span>
              <s.icon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 opacity-70" />
            </div>
            <span className="text-lg sm:text-xl font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Period stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 text-zinc-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">This week</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-lg font-bold text-black">{ordersThisWeek.length} orders</span>
            <span className="text-xl font-extrabold text-black">{formatPrice(revenueThisWeek)}</span>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-zinc-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">This month</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-lg font-bold text-black">{ordersThisMonth.length} orders</span>
            <span className="text-xl font-extrabold text-black">{formatPrice(revenueThisMonth)}</span>
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-black uppercase tracking-wider">All orders</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {filteredOrders.length} / {totalOrders} commande{totalOrders !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Filter className="h-4 w-4 text-zinc-500 shrink-0" />
              <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
                {(["all", "pending", "rejected", "delivered", "out_for_delivery"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-1.5 text-xs font-medium uppercase rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === f
                        ? "bg-white text-black shadow-sm border border-zinc-200"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {filterLabels[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <p className="px-4 sm:px-6 py-12 text-center text-zinc-500 text-sm">
              {statusFilter === "all" ? "No orders yet." : `No ${filterLabels[statusFilter].toLowerCase()} orders.`}
            </p>
          ) : (
            <>
              {/* Mobile: card layout */}
              <div className="sm:hidden divide-y divide-zinc-100">
                {filteredOrders.map((o) => (
                  <Fragment key={o.id}>
                    <div
                      onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                      className="px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-zinc-50/50"
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-black">#{o.id}</span>
                        {orderItems[o.id] && (
                          <div className="flex -space-x-2">
                            {orderItems[o.id].slice(0, 3).map((item, i) => (
                              <div key={i} className="h-8 w-8 rounded border border-white overflow-hidden bg-zinc-100 ring-1 ring-zinc-200">
                                {item.image_url ? (
                                  <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-zinc-400 text-[10px]">—</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-600 truncate">{o.full_name}</p>
                        <p className="text-[11px] text-zinc-500">{formatDateShort(o.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <p className="text-sm font-semibold text-black">{formatPrice(Number(o.total_price))}</p>
                        <p className="text-[10px] text-zinc-500">{o.items_count ?? 0} item{(o.items_count ?? 0) !== 1 ? "s" : ""}</p>
                        <p className="text-[10px] font-medium text-zinc-600">
                          Taille : {formatOrderSizes(orderItems[o.id])}
                        </p>
                        {renderPhoneConfirm(o, true)}
                        {renderStatusSelect(o, true)}
                      </div>
                      {expandedId === o.id ? <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />}
                    </div>
                    {expandedId === o.id && orderItems[o.id] && (
                      <div className="px-4 py-3 bg-zinc-50/80">
                        <p className="text-xs font-semibold text-zinc-700 mb-2">Items</p>
                        <div className="space-y-2">
                          {orderItems[o.id].map((item, i) => {
                            const label = formatOrderItemLabel(item);
                            return (
                              <div key={i} className="flex items-center gap-3 py-1.5">
                                <div className="h-10 w-10 rounded border border-zinc-200 overflow-hidden bg-zinc-100 shrink-0">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-zinc-400 text-[10px]">—</div>
                                  )}
                                </div>
                                <span className="text-xs font-medium text-black truncate flex-1 min-w-0">{label}</span>
                                <span className="text-xs text-zinc-600 font-semibold shrink-0">{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            );
                          })}
                        </div>
                        {o.email && <p className="mt-2 text-xs text-zinc-500">Email: {o.email}</p>}
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>

              {/* Desktop: table layout */}
              <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-zinc-600">Order</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-zinc-600 hidden sm:table-cell">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-zinc-600">Date</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-zinc-600 hidden md:table-cell">Conf. téléphone</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-zinc-600">Items</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-zinc-600">Taille</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-zinc-600">Total</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-zinc-600">Status</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <Fragment key={o.id}>
                    <tr
                      key={o.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50/50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-black shrink-0">#{o.id}</span>
                          {orderItems[o.id] && (
                            <div className="flex -space-x-2 shrink-0">
                              {orderItems[o.id].slice(0, 3).map((item, i) => (
                                <div key={i} className="h-8 w-8 rounded border border-white overflow-hidden bg-zinc-100 flex-shrink-0 ring-1 ring-zinc-200">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-zinc-400 text-[10px]">—</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="font-medium text-black block">{o.full_name}</span>
                        {o.city && <span className="block text-xs text-zinc-500">{o.city}, {o.governorate}</span>}
                        {o.phone_number && <span className="block text-xs text-zinc-500 mt-0.5">{o.phone_number}</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                        {renderPhoneConfirm(o)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">{o.items_count ?? 0}</td>
                      <td className="px-4 py-3 text-zinc-700 font-medium">{formatOrderSizes(orderItems[o.id])}</td>
                      <td className="px-4 py-3 text-right font-semibold text-black">{formatPrice(Number(o.total_price))}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {renderStatusSelect(o)}
                      </td>
                      <td className="px-4 py-3">
                        {expandedId === o.id ? (
                          <ChevronUp className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        )}
                      </td>
                    </tr>
                    {expandedId === o.id && orderItems[o.id] && (
                      <tr className="bg-zinc-50/50">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="pl-0 sm:pl-4 space-y-1 text-xs">
                            <p className="font-semibold text-zinc-700 mb-2">Items</p>
                            {orderItems[o.id].map((item, i) => {
                              const label = formatOrderItemLabel(item);
                              return (
                                <div key={i} className="flex items-center gap-3 py-1.5">
                                  <div className="h-12 w-12 rounded border border-zinc-200 overflow-hidden bg-zinc-100 flex-shrink-0">
                                    {item.image_url ? (
                                      <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center text-zinc-400 text-xs">—</div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-black">{label}</span>
                                  </div>
                                  <span className="text-zinc-600 font-semibold shrink-0">{formatPrice(item.price * item.quantity)}</span>
                                </div>
                              );
                            })}
                            {o.email && (
                              <p className="mt-2 text-zinc-500">Email: {o.email}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
