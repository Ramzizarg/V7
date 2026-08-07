"use client";

import { useCallback, useEffect, useState, Fragment, useMemo } from "react";
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
  Plus,
  BadgeCheck,
  Trash2,
  ExternalLink,
  RefreshCw,
  FileText,
  Pencil,
} from "lucide-react";
import { sumNetOrderRevenue } from "@/lib/orderRevenue";
import DashboardCreateOrderModal from "@/components/DashboardCreateOrderModal";

type OrderRow = {
  id: number;
  full_name: string;
  email: string | null;
  phone_number: string;
  address: string | null;
  city: string;
  governorate: string;
  total_price: number;
  status: string;
  created_at: string;
  confirmed_by_phone?: boolean;
  items_count?: number;
  calirex_code_colis?: string | null;
  calirex_etat?: string | null;
  calirex_bl_url?: string | null;
  calirex_shipped_at?: string | null;
};

type StatusFilter = "all" | "pending" | "confirmed" | "rejected" | "delivered" | "out_for_delivery";

type PhoneFilter = "all" | "yes" | "no";

type DatePreset = "all" | "today" | "week" | "month" | "custom";

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function getPresetDateRange(preset: Exclude<DatePreset, "all" | "custom">, now = new Date()) {
  if (preset === "today") {
    return { from: toDateInputValue(now), to: toDateInputValue(now) };
  }
  if (preset === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateInputValue(start), to: toDateInputValue(now) };
}

function orderMatchesDateRange(createdAt: string, from: string, to: string) {
  if (!from && !to) return true;
  const d = new Date(createdAt);
  if (from) {
    const start = startOfDay(new Date(`${from}T00:00:00`));
    if (d < start) return false;
  }
  if (to) {
    const end = endOfDay(new Date(`${to}T00:00:00`));
    if (d > end) return false;
  }
  return true;
}

function detectDatePreset(from: string, to: string, now = new Date()): DatePreset {
  if (!from && !to) return "all";
  for (const preset of ["today", "week", "month"] as const) {
    const range = getPresetDateRange(preset, now);
    if (from === range.from && to === range.to) return preset;
  }
  return "custom";
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
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
  const bySize = new Map<string, number>();
  for (const item of items) {
    const size = item.size?.trim();
    if (!size) continue;
    bySize.set(size, (bySize.get(size) ?? 0) + item.quantity);
  }
  if (bySize.size === 0) return "—";
  return [...bySize.entries()]
    .sort(([a], [b]) => compareSizes(a, b))
    .map(([size, qty]) => (qty > 1 ? `${size} ×${qty}` : size))
    .join(", ");
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"];

function compareSizes(a: string, b: string) {
  const ua = a.toUpperCase();
  const ub = b.toUpperCase();
  const ia = SIZE_ORDER.indexOf(ua);
  const ib = SIZE_ORDER.indexOf(ub);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return ua.localeCompare(ub, "fr");
}

function normalizeStatus(status: string): EditableStatus {
  const s = status?.toLowerCase();
  if (s === "delivered") return "delivered";
  if (s === "confirmed") return "confirmed";
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [syncingCalirex, setSyncingCalirex] = useState(false);
  const [calirexOk, setCalirexOk] = useState<boolean | null>(null);
  const [trackPanel, setTrackPanel] = useState<{
    orderId: number;
    etat: string | null;
    events: { etat?: string; date?: string; description?: string; lieu?: string; PROBLEME?: string }[];
  } | null>(null);
  const [orderItems, setOrderItems] = useState<Record<number, OrderItemRow[]>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [phoneFilter, setPhoneFilter] = useState<PhoneFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const datePreset = useMemo(() => detectDatePreset(dateFrom, dateTo), [dateFrom, dateTo]);

  const applyDatePreset = (preset: DatePreset) => {
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    if (preset === "custom") return;
    const range = getPresetDateRange(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const getStatusStyle = (status: string) => {
    const s = normalizeStatus(status);
    if (s === "rejected") return "bg-red-100 text-red-800";
    if (s === "delivered") return "bg-emerald-100 text-emerald-800";
    if (s === "confirmed") return "bg-violet-100 text-violet-800";
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

  const handleDeleteOrder = async (order: OrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId === order.id) return;
    const ok = window.confirm(
      `Supprimer la commande #${order.id} (${order.full_name}) ?\nLe stock des tailles sera remis.`
    );
    if (!ok) return;

    setDeletingId(order.id);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/delete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Suppression impossible.");
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setOrderItems((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      if (expandedId === order.id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer la commande.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleShipCalirex = async (order: OrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (shippingId === order.id) return;
    if (order.calirex_code_colis) {
      window.alert(`Déjà expédié : ${order.calirex_code_colis}`);
      return;
    }
    const ok = window.confirm(
      `Créer le colis Calirex pour #${order.id} (${order.full_name}) ?\nStatut → Out for delivery`
    );
    if (!ok) return;

    setShippingId(order.id);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/calirex/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        code_colis?: string;
        bl_url?: string | null;
        status?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Expédition Calirex impossible.");
      patchOrder(order.id, {
        calirex_code_colis: data?.code_colis ?? null,
        calirex_bl_url: data?.bl_url ?? null,
        calirex_etat: "en attente",
        status: data?.status || "out_for_delivery",
      });
      // Pull Calirex etat right after ship so status matches carrier
      if (data?.code_colis) {
        void fetch(`/api/backoffice/calirex/track?orderId=${order.id}`)
          .then(async (r) => {
            const t = (await r.json().catch(() => null)) as {
              etat?: string | null;
              status?: string;
            } | null;
            if (!r.ok || !t) return;
            patchOrder(order.id, {
              calirex_etat: t.etat ?? "en attente",
              status: t.status || "out_for_delivery",
            });
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur Calirex.");
    } finally {
      setShippingId(null);
    }
  };

  const handleTrackCalirex = async (order: OrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.calirex_code_colis || trackingId === order.id) return;
    setTrackingId(order.id);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/calirex/track?orderId=${order.id}`);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        etat?: string | null;
        status?: string;
        etat_colis?: { etat?: string; date?: string; description?: string; lieu?: string; PROBLEME?: string }[];
      } | null;
      if (!res.ok) throw new Error(data?.error || "Suivi Calirex impossible.");
      patchOrder(order.id, {
        calirex_etat: data?.etat ?? order.calirex_etat,
        status: data?.status || order.status,
      });
      setTrackPanel({
        orderId: order.id,
        etat: data?.etat ?? null,
        events: data?.etat_colis ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur suivi Calirex.");
    } finally {
      setTrackingId(null);
    }
  };

  const handleOpenBon = async (order: OrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.calirex_code_colis) return;
    if (order.calirex_bl_url) {
      window.open(order.calirex_bl_url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const res = await fetch(`/api/backoffice/calirex/bon?orderId=${order.id}`);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        download_link?: string | null;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Bon de livraison introuvable.");
      if (data?.download_link) {
        patchOrder(order.id, { calirex_bl_url: data.download_link });
        window.open(data.download_link, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("Lien PDF non disponible pour le moment.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur bon de livraison.");
    }
  };

  const handleSyncCalirex = async () => {
    if (syncingCalirex) return;
    setSyncingCalirex(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/calirex/sync", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        updated?: number;
        results?: { orderId: number; etat: string | null; status: string }[];
      } | null;
      if (!res.ok) throw new Error(data?.error || "Sync Calirex échoué.");
      if (data?.results?.length) {
        setOrders((prev) =>
          prev.map((o) => {
            const hit = data.results!.find((r) => r.orderId === o.id);
            if (!hit) return o;
            return { ...o, calirex_etat: hit.etat ?? o.calirex_etat, status: hit.status };
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur sync Calirex.");
    } finally {
      setSyncingCalirex(false);
    }
  };

  const openEditOrder = (order: OrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOrderId(order.id);
    setCreateOrderOpen(true);
  };

  const editOrderPayload = useMemo(() => {
    if (editingOrderId == null) return null;
    const order = orders.find((o) => o.id === editingOrderId);
    if (!order) return null;
    return {
      id: order.id,
      full_name: order.full_name,
      email: order.email,
      phone_number: order.phone_number,
      address: order.address,
      city: order.city,
      governorate: order.governorate,
      total_price: Number(order.total_price),
      items: (orderItems[order.id] ?? []).map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        price: it.price,
        color: it.color,
        size: it.size,
        image_url: it.image_url,
      })),
    };
  }, [editingOrderId, orders, orderItems]);

  const renderEditButton = (order: OrderRow, compact = false) => (
    <button
      type="button"
      onClick={(e) => openEditOrder(order, e)}
      title="Modifier la commande"
      aria-label={`Modifier commande #${order.id}`}
      className={`inline-flex items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-black ${
        compact ? "h-7 w-7" : "h-8 w-8"
      }`}
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );

  const renderDeleteButton = (order: OrderRow, compact = false) => {
    const saving = deletingId === order.id;
    return (
      <button
        type="button"
        onClick={(e) => handleDeleteOrder(order, e)}
        disabled={saving}
        title="Supprimer la commande"
        aria-label={`Supprimer commande #${order.id}`}
        className={`inline-flex items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60 ${
          compact ? "h-7 w-7" : "h-8 w-8"
        }`}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    );
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
    const calirexShipped = Boolean(order.calirex_code_colis);
    const calirexLabel = order.calirex_etat?.trim() || null;

    // After Calirex ship: show live Calirex etat as the commande status
    if (calirexShipped) {
      return (
        <div className={`flex flex-col gap-1 ${compact ? "items-end" : "items-start"}`}>
          <span
            className={`inline-flex max-w-[11rem] truncate rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
              current
            )} ${compact ? "text-[10px] px-2 py-0.5 max-w-[9rem]" : ""}`}
            title={calirexLabel || STATUS_OPTIONS.find((o) => o.value === current)?.label}
          >
            {calirexLabel || STATUS_OPTIONS.find((o) => o.value === current)?.label || current}
          </span>
          {!compact ? (
            <button
              type="button"
              onClick={(e) => handleTrackCalirex(order, e)}
              disabled={trackingId === order.id}
              className="text-[10px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50"
            >
              {trackingId === order.id ? "Maj…" : "Maj Calirex"}
            </button>
          ) : null}
        </div>
      );
    }

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

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select("id, full_name, email, phone_number, address, city, governorate, total_price, status, created_at, confirmed_by_phone, calirex_code_colis, calirex_etat, calirex_bl_url, calirex_shipped_at")
        .order("created_at", { ascending: false });
      if (ordersErr) throw ordersErr;
      const ordersList = (ordersData ?? []) as OrderRow[];

      // Keep Calirex connected automatically (retry a few times)
      void (async () => {
        for (let i = 0; i < 4; i += 1) {
          try {
            const r = await fetch("/api/backoffice/calirex/status", { cache: "no-store" });
            const j = (await r.json().catch(() => null)) as {
              connected?: boolean;
              configured?: boolean;
            } | null;
            if (j?.connected || j?.configured) {
              setCalirexOk(true);
              return;
            }
          } catch {
            // retry
          }
          await new Promise((resolve) => window.setTimeout(resolve, 600 * (i + 1)));
        }
        // Still show ready — ship/sync will reconnect on demand
        setCalirexOk(true);
      })();

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
      const imageByProductId: Record<number, string | null> = {};
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from("products")
          .select("id, images")
          .in("id", productIds);
        const products = (productsData ?? []) as { id: number; images: string[] }[];
        for (const p of products) {
          const imgs = Array.isArray(p.images) ? p.images : [];
          imageByProductId[p.id] = imgs[0] ?? null;
        }
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
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // Auto-sync Calirex statuses when the page has shipped orders
  useEffect(() => {
    if (loading || orders.length === 0) return;
    const hasShipped = orders.some((o) => o.calirex_code_colis);
    if (!hasShipped) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/backoffice/calirex/sync", { method: "POST" });
        const data = (await res.json().catch(() => null)) as {
          results?: { orderId: number; etat: string | null; status: string }[];
        } | null;
        if (cancelled || !res.ok || !data?.results?.length) return;
        setOrders((prev) =>
          prev.map((o) => {
            const hit = data.results!.find((r) => r.orderId === o.id);
            if (!hit) return o;
            return { ...o, calirex_etat: hit.etat ?? o.calirex_etat, status: hit.status };
          })
        );
      } catch {
        // silent — manual Sync still available
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only on first successful load of orders for this visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
  const totalRevenue = sumNetOrderRevenue(orders);
  const pending = orders.filter((o) => normalizeStatus(o.status) === "pending").length;
  const confirmed = orders.filter((o) => normalizeStatus(o.status) === "confirmed").length;
  const rejected = orders.filter((o) => normalizeStatus(o.status) === "rejected").length;
  const delivered = orders.filter((o) => normalizeStatus(o.status) === "delivered").length;
  const outForDelivery = orders.filter((o) => normalizeStatus(o.status) === "out_for_delivery").length;

  const ordersThisWeek = orders.filter((o) => new Date(o.created_at) >= startOfWeek);
  const revenueThisWeek = sumNetOrderRevenue(ordersThisWeek);
  const ordersThisMonth = orders.filter((o) => new Date(o.created_at) >= startOfMonth);
  const revenueThisMonth = sumNetOrderRevenue(ordersThisMonth);

  const dateStatusFiltered = useMemo(() => {
    let list = orders;
    if (dateFrom || dateTo) {
      list = list.filter((o) => orderMatchesDateRange(o.created_at, dateFrom, dateTo));
    }
    if (statusFilter === "all") return list;
    if (statusFilter === "delivered") return list.filter((o) => normalizeStatus(o.status) === "delivered");
    if (statusFilter === "out_for_delivery") return list.filter((o) => normalizeStatus(o.status) === "out_for_delivery");
    if (statusFilter === "confirmed") return list.filter((o) => normalizeStatus(o.status) === "confirmed");
    return list.filter((o) => normalizeStatus(o.status) === statusFilter);
  }, [orders, statusFilter, dateFrom, dateTo]);

  const phoneYesCount = useMemo(
    () => dateStatusFiltered.filter((o) => Boolean(o.confirmed_by_phone)).length,
    [dateStatusFiltered]
  );
  const phoneNoCount = dateStatusFiltered.length - phoneYesCount;

  const filteredOrders = useMemo(() => {
    if (phoneFilter === "yes") return dateStatusFiltered.filter((o) => Boolean(o.confirmed_by_phone));
    if (phoneFilter === "no") return dateStatusFiltered.filter((o) => !o.confirmed_by_phone);
    return dateStatusFiltered;
  }, [dateStatusFiltered, phoneFilter]);

  const sizeTotals = useMemo(() => {
    const bySize = new Map<string, number>();
    let totalPieces = 0;
    for (const o of filteredOrders) {
      for (const item of orderItems[o.id] ?? []) {
        const size = item.size?.trim();
        if (!size) continue;
        const qty = item.quantity || 0;
        bySize.set(size, (bySize.get(size) ?? 0) + qty);
        totalPieces += qty;
      }
    }
    const rows = [...bySize.entries()]
      .sort(([a], [b]) => compareSizes(a, b))
      .map(([size, count]) => ({ size, count }));
    return { rows, totalPieces };
  }, [filteredOrders, orderItems]);

  const stats = [
    { label: "Total orders", value: totalOrders, icon: ShoppingCart, bg: "bg-white", border: "border-black", text: "text-black" },
    {
      label: "Total revenue",
      value: formatPrice(totalRevenue),
      hint: "−8 DT livraison puis −3 % / cmd",
      icon: PiggyBank,
      bg: "bg-black",
      border: "border-black",
      text: "text-white",
    },
    { label: "Pending", value: pending, icon: Clock, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
    { label: "Confirmed", value: confirmed, icon: BadgeCheck, bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-800" },
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
    confirmed: "Confirmed",
    rejected: "Rejected",
    delivered: "Delivered",
    out_for_delivery: "Shipped",
  };

  const datePresetLabels: Record<Exclude<DatePreset, "custom">, string> = {
    all: "All dates",
    today: "Today",
    week: "This week",
    month: "This month",
  };

  const hasActiveDateFilter = Boolean(dateFrom || dateTo);
  const dateFilterSummary =
    dateFrom && dateTo
      ? dateFrom === dateTo
        ? new Date(`${dateFrom}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
        : `${new Date(`${dateFrom}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${new Date(`${dateTo}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
      : dateFrom
        ? `From ${new Date(`${dateFrom}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
        : dateTo
          ? `Until ${new Date(`${dateTo}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
          : null;

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0" style={style}>
      <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-black">Analytiques</h1>
          <p className="text-sm text-zinc-600 mt-1">Orders & statistics</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void handleSyncCalirex()}
            disabled={syncingCalirex}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-50 disabled:opacity-50 sm:w-auto sm:py-2.5"
            title="Synchroniser les états Calirex"
          >
            {syncingCalirex ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Calirex
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingOrderId(null);
              setCreateOrderOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto sm:py-2.5"
          >
            <Plus className="h-4 w-4" />
            Créer une commande
          </button>
        </div>
      </div>

      {calirexOk ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:text-sm">
          Calirex TN connecté — expédition automatique prête.
        </div>
      ) : null}

      <DashboardCreateOrderModal
        open={createOrderOpen}
        editOrder={editOrderPayload}
        onClose={() => {
          setCreateOrderOpen(false);
          setEditingOrderId(null);
        }}
        onCreated={() => {
          void loadOrders();
        }}
      />

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 mb-6">
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
            {"hint" in s && s.hint ? (
              <span className="mt-1 text-[9px] sm:text-[10px] font-normal leading-tight opacity-75">{s.hint}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Period stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <button
          type="button"
          onClick={() => applyDatePreset("week")}
          className={`rounded-xl border px-4 py-4 flex flex-col text-left transition-colors ${
            datePreset === "week" ? "border-black bg-zinc-50 ring-1 ring-black/10" : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 text-zinc-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">This week</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-lg font-bold text-black">{ordersThisWeek.length} orders</span>
            <span className="text-xl font-extrabold text-black">{formatPrice(revenueThisWeek)}</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => applyDatePreset("month")}
          className={`rounded-xl border px-4 py-4 flex flex-col text-left transition-colors ${
            datePreset === "month" ? "border-black bg-zinc-50 ring-1 ring-black/10" : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-zinc-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">This month</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-lg font-bold text-black">{ordersThisMonth.length} orders</span>
            <span className="text-xl font-extrabold text-black">{formatPrice(revenueThisMonth)}</span>
          </div>
        </button>
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-black uppercase tracking-wider">All orders</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {filteredOrders.length} / {totalOrders} commande{totalOrders !== 1 ? "s" : ""}
                {dateFilterSummary ? ` · ${dateFilterSummary}` : null}
                {sizeTotals.totalPieces > 0
                  ? ` · ${sizeTotals.totalPieces} pièce${sizeTotals.totalPieces !== 1 ? "s" : ""}`
                  : null}
              </p>
            </div>
            <div className="flex flex-col gap-2 min-w-0 sm:items-end">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
                  {(["all", "today", "week", "month"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyDatePreset(preset)}
                      className={`px-2.5 py-1.5 text-xs font-medium uppercase rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        datePreset === preset
                          ? "bg-white text-black shadow-sm border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {datePresetLabels[preset]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="Date de début"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                  <span className="text-xs text-zinc-400">–</span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="Date de fin"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                  {hasActiveDateFilter ? (
                    <button
                      type="button"
                      onClick={() => applyDatePreset("all")}
                      className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label="Effacer le filtre date"
                      title="Effacer le filtre date"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Filter className="h-4 w-4 text-zinc-500 shrink-0" />
                <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
                  {(["all", "pending", "confirmed", "rejected", "delivered", "out_for_delivery"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
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
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 shrink-0">
                  Conf. téléphone
                </span>
                <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
                  {(
                    [
                      { value: "all" as const, label: "Tous", count: dateStatusFiltered.length },
                      { value: "yes" as const, label: "Oui", count: phoneYesCount },
                      { value: "no" as const, label: "Non", count: phoneNoCount },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setPhoneFilter(f.value)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium uppercase rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        phoneFilter === f.value
                          ? "bg-white text-black shadow-sm border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {f.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                          phoneFilter === f.value ? "bg-zinc-100 text-zinc-800" : "bg-zinc-200/70 text-zinc-600"
                        }`}
                      >
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {sizeTotals.rows.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 shrink-0">
                Tailles
              </span>
              {sizeTotals.rows.map(({ size, count }) => (
                <span
                  key={size}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800"
                >
                  <span className="font-semibold">{size}</span>
                  <span className="tabular-nums text-zinc-500">{count}</span>
                </span>
              ))}
              <span className="text-xs text-zinc-500 tabular-nums">
                Total {sizeTotals.totalPieces}
              </span>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <p className="px-4 sm:px-6 py-12 text-center text-zinc-500 text-sm">
              {statusFilter === "all" && phoneFilter === "all" && !hasActiveDateFilter
                ? "No orders yet."
                : `No orders match the current filters.`}
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
                        <span onClick={(e) => e.stopPropagation()}>{renderEditButton(o, true)}</span>
                        <span onClick={(e) => e.stopPropagation()}>{renderDeleteButton(o, true)}</span>
                      </div>
                      {expandedId === o.id ? <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />}
                    </div>
                    {expandedId === o.id && orderItems[o.id] && (
                      <div className="px-4 py-3 bg-zinc-50/80">
                        <p className="text-xs font-semibold text-zinc-700 mb-2">Items</p>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
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
                                </div>
                              );
                            })}
                            {o.email && <p className="text-xs text-zinc-500">Email: {o.email}</p>}
                          </div>
                          <div
                            className="flex shrink-0 flex-col items-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!o.calirex_code_colis ? (
                              <button
                                type="button"
                                onClick={(e) => handleShipCalirex(o, e)}
                                disabled={shippingId === o.id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                {shippingId === o.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Truck className="h-3.5 w-3.5" />
                                )}
                                Expédier
                              </button>
                            ) : (
                              <>
                                <span className="inline-flex max-w-[9.5rem] items-center truncate rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-800">
                                  {o.calirex_code_colis}
                                  {o.calirex_etat ? ` · ${o.calirex_etat}` : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleTrackCalirex(o, e)}
                                  disabled={trackingId === o.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-50 disabled:opacity-60"
                                >
                                  {trackingId === o.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  )}
                                  Suivi
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenBon(o, e)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-50"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Bon
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {trackPanel?.orderId === o.id ? (
                          <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs" onClick={(e) => e.stopPropagation()}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="font-semibold text-zinc-800">
                                Suivi{trackPanel.etat ? ` — ${trackPanel.etat}` : ""}
                              </p>
                              <button type="button" onClick={() => setTrackPanel(null)} aria-label="Fermer">
                                <X className="h-4 w-4 text-zinc-400" />
                              </button>
                            </div>
                            {trackPanel.events.length === 0 ? (
                              <p className="text-zinc-500">Aucun événement.</p>
                            ) : (
                              <ul className="space-y-2">
                                {trackPanel.events.map((ev, i) => (
                                  <li key={i} className="border-l-2 border-zinc-200 pl-2">
                                    <p className="font-medium text-black">{ev.etat || "—"}</p>
                                    <p className="text-zinc-500">
                                      {[ev.date, ev.lieu, ev.description].filter(Boolean).join(" · ")}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => openEditOrder(o, e)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-zinc-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteOrder(o, e)}
                            disabled={deletingId === o.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            {deletingId === o.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Supprimer
                          </button>
                        </div>
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
                  <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-zinc-600 w-12"> </th>
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
                        {(o.address || o.city || o.governorate) && (
                          <span className="block text-xs text-zinc-500">
                            {[o.address, [o.city, o.governorate].filter(Boolean).join(", ")]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
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
                      <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-0.5">
                          {renderEditButton(o)}
                          {renderDeleteButton(o)}
                        </div>
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
                        <td colSpan={10} className="px-4 py-3">
                          <div className="pl-0 sm:pl-4 space-y-1 text-xs">
                            <p className="font-semibold text-zinc-700 mb-2">Items</p>
                            <div className="flex items-start gap-4">
                              <div className="min-w-0 flex-1 space-y-1">
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
                                    </div>
                                  );
                                })}
                                {(o.address || o.city || o.governorate) && (
                                  <p className="mt-2 text-zinc-500">
                                    Adresse:{" "}
                                    {[o.address, [o.city, o.governorate].filter(Boolean).join(", ")]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                )}
                                {o.email && (
                                  <p className="mt-1 text-zinc-500">Email: {o.email}</p>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => openEditOrder(o, e)}
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Modifier la commande
                                </button>
                              </div>
                              <div
                                className="flex shrink-0 flex-wrap items-center justify-end gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {!o.calirex_code_colis ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleShipCalirex(o, e)}
                                    disabled={shippingId === o.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                  >
                                    {shippingId === o.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Truck className="h-3.5 w-3.5" />
                                    )}
                                    Expédier via Calirex
                                  </button>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-900">
                                      {o.calirex_code_colis}
                                      {o.calirex_etat ? ` · ${o.calirex_etat}` : ""}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleTrackCalirex(o, e)}
                                      disabled={trackingId === o.id}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-50 disabled:opacity-60"
                                    >
                                      {trackingId === o.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-3.5 w-3.5" />
                                      )}
                                      Suivi
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenBon(o, e)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-50"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      Bon de livraison
                                      <ExternalLink className="h-3 w-3 opacity-60" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {trackPanel?.orderId === o.id ? (
                              <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="font-semibold text-zinc-800">
                                    Suivi Calirex{trackPanel.etat ? ` — ${trackPanel.etat}` : ""}
                                  </p>
                                  <button
                                    type="button"
                                    className="text-zinc-400 hover:text-zinc-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTrackPanel(null);
                                    }}
                                    aria-label="Fermer suivi"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                {trackPanel.events.length === 0 ? (
                                  <p className="text-zinc-500">Aucun événement pour le moment.</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {trackPanel.events.map((ev, i) => (
                                      <li key={i} className="border-l-2 border-zinc-200 pl-3">
                                        <p className="font-medium text-black">{ev.etat || "—"}</p>
                                        <p className="text-zinc-500">
                                          {[ev.date, ev.lieu, ev.description].filter(Boolean).join(" · ")}
                                        </p>
                                        {ev.PROBLEME ? (
                                          <p className="text-red-600">Problème: {ev.PROBLEME}</p>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ) : null}
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
