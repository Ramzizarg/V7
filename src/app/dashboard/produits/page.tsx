"use client";

import { useEffect, useState, useRef } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { productPathSlug } from "@/lib/productUrl";
import type { Product, Category, Color, Coupon } from "@/lib/types";
import { uploadSizeGuideImage, uploadProductImage } from "@/lib/uploadProductImage";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Upload,
  ChevronDown,
  ChevronRight,
  List,
  Star,
  Eye,
  Percent,
  LayoutGrid,
  GripVertical,
} from "lucide-react";

const SIZES = ["Standard", "S", "M", "L", "XL", "XXL"];

function CouponCountdown({ expiresAt, startsAt }: { expiresAt: string | null; startsAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const startMs = startsAt ? new Date(startsAt).getTime() : 0;
  const endMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  if (!expiresAt) return null;
  if (now < startMs && startsAt) {
    const s = Math.max(0, Math.floor((startMs - now) / 1000));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    const str = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
    return <span className="block text-amber-600 mt-0.5 font-medium">Starts in {str}</span>;
  }
  if (now >= endMs) return <span className="block text-red-600 mt-0.5 font-medium">Expired</span>;
  const s = Math.max(0, Math.floor((endMs - now) / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const str = d > 0 ? `${d}d ${h % 24}h ${m % 60}m` : h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  return <span className="block text-zinc-500 mt-0.5 font-medium tabular-nums">⏱ {str} left</span>;
}

const DEFAULT_MEASUREMENT: string[][] = [
  ["Taille", "Mesure 1", "Mesure 2"],
  ["XS", "", ""],
  ["S", "", ""],
  ["M", "", ""],
];

function parseMeasurementTable(raw: string | null | undefined | unknown): string[][] {
  const fallback = () => DEFAULT_MEASUREMENT.map((r) => [...r]);
  if (raw == null) return fallback();
  if (Array.isArray(raw)) {
    const rows = raw as unknown[][];
    if (!rows.length) return fallback();
    return rows.map((line) =>
      Array.isArray(line) ? line.map((c) => String(c ?? "")) : [String(line ?? "")]
    );
  }
  if (typeof raw !== "string") return fallback();
  if (!raw.trim()) return fallback();
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as string[][];
      if (!Array.isArray(parsed) || parsed.length === 0) return fallback();
      return parsed.map((line) =>
        Array.isArray(line) ? line.map((c) => String(c ?? "")) : [String(line ?? "")]
      );
    } catch {
      // fallback to CSV
    }
  }
  const rows = trimmed.split(/\r?\n/).map((line) => line.split(",").map((c) => c.trim()));
  return rows.length > 0 ? rows : fallback();
}

function normalizeProductImages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x ?? "").trim())
      .filter((x) => x.length > 0);
  }
  if (typeof raw !== "string") return [];
  const t = raw.trim();
  if (!t) return [];
  if (t.startsWith("{") && t.endsWith("}")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((s) => s.trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"'))
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0);
    }
  } catch {
    // keep plain URL fallback
  }
  return [t];
}

function formatColorPair(p: Product, palette: Color[]): string {
  const a = palette.find((c) => c.id === p.color_id)?.name?.trim() || p.color?.trim();
  const b =
    p.color_2_id != null
      ? palette.find((c) => c.id === p.color_2_id)?.name?.trim() || p.color_2?.trim()
      : null;
  if (a && b) return `${a} + ${b}`;
  return a || b || "—";
}

export default function DashboardProduitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingStockId, setTogglingStockId] = useState<number | null>(null);
  const [showUrlImages, setShowUrlImages] = useState(false);
  const [sizeGuideUploading, setSizeGuideUploading] = useState(false);
  const [productImagesUploading, setProductImagesUploading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("100");
  const [discountPrice, setDiscountPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [colorId, setColorId] = useState<string>("");
  const [colorId2, setColorId2] = useState<string>("");
  const [imagesStr, setImagesStr] = useState("");
  const [sizeGuideUrl, setSizeGuideUrl] = useState("");
  const [measurementRows, setMeasurementRows] = useState<string[][]>([
    ["Taille", "Mesure 1", "Mesure 2"],
    ["XS", "", ""],
    ["S", "", ""],
    ["M", "", ""],
  ]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [productImageUrls, setProductImageUrls] = useState<string[]>([]);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "fixed">("percent");
  const [couponValue, setCouponValue] = useState("");
  const [couponProductId, setCouponProductId] = useState<string>("");
  const [couponExpiryMode, setCouponExpiryMode] = useState<"none" | "preset" | "custom">("none");
  const [couponPreset, setCouponPreset] = useState<string>("");
  const [couponStartDate, setCouponStartDate] = useState("");
  const [couponStartTime, setCouponStartTime] = useState("");
  const [couponEndDate, setCouponEndDate] = useState("");
  const [couponEndTime, setCouponEndTime] = useState("");
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [deletingCouponId, setDeletingCouponId] = useState<number | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<number | null>(null);
  const [savingCategoryOrder, setSavingCategoryOrder] = useState(false);
  const categoryFormRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const [productsRes, categoriesRes, colorsRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("*"),
        supabase.from("colors").select("*").order("name"),
      ]);
      const couponsRes = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (colorsRes.error) throw colorsRes.error;
      setProducts((productsRes.data ?? []) as Product[]);
      const cats = (categoriesRes.data ?? []) as Category[];
      cats.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      setCategories(cats);
      setColors((colorsRes.data ?? []) as Color[]);
      if (!couponsRes.error) setCoupons((couponsRes.data ?? []) as Coupon[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setStock("100");
    setDiscountPrice("");
    setCategoryId("");
    setColorId("");
    setColorId2("");
    setImagesStr("");
    setSizeGuideUrl("");
    setMeasurementRows([["Taille", "Mesure 1", "Mesure 2"], ["XS", "", ""], ["S", "", ""], ["M", "", ""]]);
    setSizes([]);
    setProductImageUrls([]);
    setShowUrlImages(false);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description ?? "");
    setPrice(String(p.price));
    setStock(String(p.stock));
    setDiscountPrice(p.discount_price != null ? String(p.discount_price) : "");
    setCategoryId(p.category_id ? String(p.category_id) : "");
    setColorId(p.color_id ? String(p.color_id) : "");
    setColorId2(p.color_2_id ? String(p.color_2_id) : "");
    setImagesStr("");
    setSizeGuideUrl(p.size_guide_image ?? "");
    setMeasurementRows(parseMeasurementTable(p.measurement_table as unknown));
    setSizes(Array.isArray(p.sizes) ? p.sizes : []);
    setProductImageUrls(normalizeProductImages(p.images));
    setShowUrlImages(false);
    setFormOpen(true);
  };

  const toggleSize = (size: string) => {
    setSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const setPrincipalProductImage = (index: number) => {
    setProductImageUrls((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [img] = next.splice(index, 1);
      return [img, ...next];
    });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const urlImages = imagesStr
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const allImages = [...normalizeProductImages(productImageUrls), ...urlImages]
        .map((u) => String(u ?? "").trim())
        .filter((u) => u.length > 0);
      if (allImages.length === 0) {
        throw new Error("Ajoutez au moins une image produit avant de sauvegarder.");
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        stock: parseInt(stock, 10) || 0,
        category_id: categoryId ? parseInt(categoryId, 10) : null,
        color_id: colorId ? parseInt(colorId, 10) : null,
        color_id_2: colorId2 ? parseInt(colorId2, 10) : null,
        images: allImages,
        discount_price: discountPrice ? parseFloat(discountPrice) : null,
        size_guide_image: sizeGuideUrl || null,
        measurement_table:
          measurementRows.length > 0 ? measurementRows.map((r) => [...r]) : null,
        sizes: sizes.filter((s) => typeof s === "string" && s.trim().length > 0),
      };

      if (editing) {
        const { error: err } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("products").insert(payload);
        if (err) throw err;
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const isInStock = (p: Product) => Number(p.stock ?? 0) > 0;

  const handleToggleStock = async (p: Product) => {
    setTogglingStockId(p.id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const newStock = isInStock(p) ? 0 : 100;
      const { error: err } = await supabase.from("products").update({ stock: newStock }).eq("id", p.id);
      if (err) throw err;
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: newStock } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setTogglingStockId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { error: err } = await supabase.from("products").delete().eq("id", id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    const value = parseFloat(couponValue);
    if (!code || isNaN(value) || value < 0) return;
    if (couponType === "percent" && value > 100) return;
    setSavingCoupon(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      let startsAt: string | null = null;
      let expiresAt: string | null = null;

      if (couponExpiryMode === "preset" && couponPreset) {
        const now = new Date();
        const hours = { "1h": 1, "2h": 2, "24h": 24 }[couponPreset] ?? 0;
        startsAt = now.toISOString();
        expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
      } else if (couponExpiryMode === "custom") {
        if (couponStartDate && couponStartTime) {
          startsAt = new Date(`${couponStartDate}T${couponStartTime}:00`).toISOString();
        }
        if (couponEndDate && couponEndTime) {
          expiresAt = new Date(`${couponEndDate}T${couponEndTime}:00`).toISOString();
        }
      }

      const payload = {
        code,
        discount_type: couponType,
        discount_value: value,
        product_id: couponProductId ? parseInt(couponProductId, 10) : null,
        active: true,
        starts_at: startsAt,
        expires_at: expiresAt,
      };
      if (editingCoupon) {
        const { error: err } = await supabase.from("coupons").update(payload).eq("id", editingCoupon.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("coupons").insert(payload);
        if (err) throw err;
      }
      cancelEditCoupon();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coupon create error");
    } finally {
      setSavingCoupon(false);
    }
  };

  const openEditCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setCouponCode(c.code);
    setCouponType(c.discount_type);
    setCouponValue(String(c.discount_value));
    setCouponProductId(c.product_id ? String(c.product_id) : "");
    if (c.starts_at || c.expires_at) {
      setCouponExpiryMode("custom");
      if (c.starts_at) {
        const s = new Date(c.starts_at);
        setCouponStartDate(s.toISOString().slice(0, 10));
        setCouponStartTime(s.toTimeString().slice(0, 5));
      } else {
        setCouponStartDate("");
        setCouponStartTime("");
      }
      if (c.expires_at) {
        const e = new Date(c.expires_at);
        setCouponEndDate(e.toISOString().slice(0, 10));
        setCouponEndTime(e.toTimeString().slice(0, 5));
      } else {
        setCouponEndDate("");
        setCouponEndTime("");
      }
      setCouponPreset("");
    } else {
      setCouponExpiryMode("none");
      setCouponPreset("");
      setCouponStartDate("");
      setCouponStartTime("");
      setCouponEndDate("");
      setCouponEndTime("");
    }
  };

  const cancelEditCoupon = () => {
    setEditingCoupon(null);
    setCouponCode("");
    setCouponType("percent");
    setCouponValue("");
    setCouponProductId("");
    setCouponExpiryMode("none");
    setCouponPreset("");
    setCouponStartDate("");
    setCouponStartTime("");
    setCouponEndDate("");
    setCouponEndTime("");
  };

  const handleDeleteCoupon = async (id: number) => {
    if (!confirm("Delete this coupon?")) return;
    if (editingCoupon?.id === id) cancelEditCoupon();
    setDeletingCouponId(id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { error: err } = await supabase.from("coupons").delete().eq("id", id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coupon delete error");
    } finally {
      setDeletingCouponId(null);
    }
  };

  function nameToSlug(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "category";
  }

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategorySlug("");
  };

  const openEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCategoryName(c.name);
    setCategorySlug(c.slug);
    setTimeout(() => categoryFormRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
  };

  const closeCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategorySlug("");
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = categoryName.trim();
    const slug = categorySlug.trim() || nameToSlug(name);
    if (!name) return;
    setSavingCategory(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      if (editingCategory) {
        const { error: err } = await supabase
          .from("categories")
          .update({ name, slug })
          .eq("id", editingCategory.id);
        if (err) throw err;
      } else {
        const sortOrder = categories.length;
        const { error: err } = await supabase.from("categories").insert({ name, slug, sort_order: sortOrder });
        if (err) throw err;
      }
      closeCategoryForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Category save error");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const usedBy = products.filter((p) => p.category_id === id).length;
    if (usedBy > 0) {
      setError(`Cannot delete: ${usedBy} product(s) use this category. Change their category first.`);
      return;
    }
    if (!confirm("Delete this category?")) return;
    if (editingCategory?.id === id) closeCategoryForm();
    setDeletingCategoryId(id);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { error: err } = await supabase.from("categories").delete().eq("id", id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Category delete error");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleCategoryDragStart = (e: React.DragEvent, id: number) => {
    setDraggedCategoryId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleCategoryDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedCategoryId !== null && draggedCategoryId !== id) setDragOverCategoryId(id);
  };

  const handleCategoryDragLeave = () => {
    setDragOverCategoryId(null);
  };

  const handleCategoryDragEnd = () => {
    setDraggedCategoryId(null);
    setDragOverCategoryId(null);
  };

  const handleCategoryDrop = async (e: React.DragEvent, dropId: number) => {
    e.preventDefault();
    setDragOverCategoryId(null);
    const dragId = draggedCategoryId;
    setDraggedCategoryId(null);
    if (dragId == null || dragId === dropId) return;
    const idx = categories.findIndex((c) => c.id === dragId);
    const dropIdx = categories.findIndex((c) => c.id === dropId);
    if (idx === -1 || dropIdx === -1) return;
    const next = [...categories];
    const [removed] = next.splice(idx, 1);
    next.splice(dropIdx, 0, removed);
    setCategories(next);
    setSavingCategoryOrder(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      for (let i = 0; i < next.length; i++) {
        const { error: err } = await supabase.from("categories").update({ sort_order: i }).eq("id", next[i].id);
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
      await load();
    } finally {
      setSavingCategoryOrder(false);
    }
  };

  const style = {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-20" style={style}>
        <p className="text-sm text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full min-w-0" style={style}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-black">Gestion des produits</h1>
          <p className="text-sm text-zinc-500 mt-1">Créer, modifier et supprimer des produits.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setFormOpen(false);
              setEditing(null);
              setDiscountOpen(false);
              setCategoriesOpen(false);
            }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              (!formOpen && !discountOpen && !categoriesOpen) || editing
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="All products"
          >
            <List className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">All products</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormOpen(false);
              setEditing(null);
              setDiscountOpen(false);
              setCategoriesOpen((v) => !v);
            }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              categoriesOpen
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="Categories"
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Categories</span>
          </button>
          <button
            type="button"
            onClick={() => { setFormOpen(false); setEditing(null); setCategoriesOpen(false); setDiscountOpen((v) => !v); }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              discountOpen
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="Discount"
          >
            <Percent className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Discount</span>
          </button>
          <button
            type="button"
            onClick={() => { setDiscountOpen(false); setCategoriesOpen(false); openCreate(); }}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 sm:px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors min-w-[2.75rem] sm:min-w-0 ${
              formOpen && !editing
                ? "bg-black text-white hover:bg-zinc-800"
                : "bg-white text-black border border-zinc-300 hover:bg-zinc-50"
            }`}
            title="Add product"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Add product</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Categories CRUD panel */}
      {categoriesOpen && (
        <div className="mb-6 sm:mb-8 bg-white rounded-xl border border-zinc-200 shadow-lg max-w-3xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
            <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Categories & couleurs
            </h2>
            <button
              type="button"
              onClick={() => setCategoriesOpen(false)}
              className="p-2 text-zinc-500 hover:text-black rounded shrink-0 self-end sm:self-center"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-6">
            <div ref={categoryFormRef}>
            <form onSubmit={handleSaveCategory} className="space-y-4 pb-6 border-b border-zinc-200">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wider">
                  {editingCategory ? "Edit category" : "New category"}
                </h3>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={closeCategoryForm}
                    className="text-xs text-zinc-500 hover:text-black underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Name *</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => {
                      setCategoryName(e.target.value);
                      if (!editingCategory) setCategorySlug(nameToSlug(e.target.value));
                    }}
                    placeholder="e.g. T-Shirts & Tank Tops"
                    required
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    placeholder="e.g. t-shirts-tank-tops"
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                  <p className="mt-0.5 text-[10px] text-zinc-500">Used in /shop?category=slug</p>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingCategory}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-black text-white rounded hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingCategory ? "Save" : "Add category"}
              </button>
            </form>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">
                Existing categories {savingCategoryOrder && <Loader2 className="inline h-3.5 w-3.5 animate-spin ml-1" />}
              </h3>
              <p className="text-[10px] text-zinc-500 mb-2">Drag to reorder (order is used on the shop page).</p>
              {categories.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">No categories yet. Create one above.</p>
              ) : (
                <ul className="space-y-2">
                  {categories.map((c) => {
                    const productCount = products.filter((p) => p.category_id === c.id).length;
                    const isDragging = draggedCategoryId === c.id;
                    const isDragOver = dragOverCategoryId === c.id;
                    return (
                      <li
                        key={c.id}
                        draggable
                        onDragStart={(e) => handleCategoryDragStart(e, c.id)}
                        onDragOver={(e) => handleCategoryDragOver(e, c.id)}
                        onDragLeave={handleCategoryDragLeave}
                        onDragEnd={handleCategoryDragEnd}
                        onDrop={(e) => handleCategoryDrop(e, c.id)}
                        className={`flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg border transition-colors cursor-grab active:cursor-grabbing ${
                          isDragging ? "border-zinc-400 bg-zinc-100 opacity-70" : isDragOver ? "border-black bg-zinc-100 ring-1 ring-black" : "border-zinc-200 bg-zinc-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-zinc-400 shrink-0 touch-none" aria-hidden>
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-black">{c.name}</span>
                            <span className="text-zinc-500 text-xs ml-2">/{c.slug}</span>
                            {productCount > 0 && (
                              <span className="block text-[10px] text-zinc-500 mt-0.5">{productCount} product(s)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEditCategory(c)}
                            className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded transition-colors"
                            aria-label="Edit category"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            disabled={deletingCategoryId === c.id || productCount > 0}
                            className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete category"
                            title={productCount > 0 ? "Remove category from products first" : "Delete category"}
                          >
                            {deletingCategoryId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-zinc-200 pt-5">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">
                Liste des couleurs
              </h3>
              {colors.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">Aucune couleur disponible.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {colors.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border border-black/20"
                          style={{ backgroundColor: c.hex || "#ffffff" }}
                          aria-hidden
                        />
                        <span className="truncate text-sm font-medium text-black">{c.name}</span>
                      </div>
                      <span className="text-[11px] text-zinc-500">{c.slug}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discount / Coupons panel */}
      {discountOpen && (
        <div className="mb-6 sm:mb-8 bg-white rounded-xl border border-zinc-200 shadow-lg max-w-3xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
            <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
              <Percent className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Coupons & discount
            </h2>
            <button
              type="button"
              onClick={() => setDiscountOpen(false)}
              className="p-2 text-zinc-500 hover:text-black rounded shrink-0 self-end sm:self-center"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-6">
            <form onSubmit={handleCreateCoupon} className="space-y-4 pb-6 border-b border-zinc-200">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wider">
                  {editingCoupon ? "Edit coupon" : "New coupon"}
                </h3>
                {editingCoupon && (
                  <button
                    type="button"
                    onClick={cancelEditCoupon}
                    className="text-xs text-zinc-500 hover:text-black underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Code *</label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SALE20"
                    required
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Type</label>
                  <select
                    value={couponType}
                    onChange={(e) => setCouponType(e.target.value as "percent" | "fixed")}
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed (DT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Value * {couponType === "percent" ? "(0–100)" : "(DT)"}
                  </label>
                  <input
                    type="number"
                    step={couponType === "percent" ? "1" : "0.01"}
                    min="0"
                    max={couponType === "percent" ? "100" : undefined}
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    placeholder={couponType === "percent" ? "20" : "10"}
                    required
                    className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">Product (optional)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCouponProductId("")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      !couponProductId
                        ? "border-black bg-black text-white"
                        : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                    }`}
                  >
                    All products
                  </button>
                  {products.map((p) => {
                    const img = normalizeProductImages(p.images)[0] ?? null;
                    const selected = couponProductId === String(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCouponProductId(selected ? "" : String(p.id))}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors overflow-hidden ${
                          selected
                            ? "border-black bg-black text-white"
                            : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                        }`}
                      >
                        <span className="w-8 h-8 rounded bg-zinc-100 shrink-0 overflow-hidden flex items-center justify-center">
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-zinc-400 text-[10px]">—</span>
                          )}
                        </span>
                        <span className="truncate max-w-[120px]">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">Expired time (optional)</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => { setCouponExpiryMode("none"); setCouponPreset(""); }}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      couponExpiryMode === "none"
                        ? "border-black bg-black text-white"
                        : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                    }`}
                  >
                    No expiry
                  </button>
                  {(["1h", "2h", "24h"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => { setCouponExpiryMode("preset"); setCouponPreset(preset); }}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        couponExpiryMode === "preset" && couponPreset === preset
                          ? "border-black bg-black text-white"
                          : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCouponExpiryMode("custom")}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      couponExpiryMode === "custom"
                        ? "border-black bg-black text-white"
                        : "border-zinc-300 bg-white text-black hover:border-zinc-400"
                    }`}
                  >
                    Custom date
                  </button>
                </div>
                {couponExpiryMode === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Start (date début)</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={couponStartDate}
                          onChange={(e) => setCouponStartDate(e.target.value)}
                          className="flex-1 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                        <input
                          type="time"
                          value={couponStartTime}
                          onChange={(e) => setCouponStartTime(e.target.value)}
                          className="w-24 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">End (date fin)</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={couponEndDate}
                          onChange={(e) => setCouponEndDate(e.target.value)}
                          className="flex-1 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                        <input
                          type="time"
                          value={couponEndTime}
                          onChange={(e) => setCouponEndTime(e.target.value)}
                          className="w-24 bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={savingCoupon}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-black text-white rounded hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingCoupon ? "Save" : "Create coupon"}
              </button>
            </form>
            <div>
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">Existing coupons</h3>
              {coupons.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">No coupons yet. Create one above.</p>
              ) : (
                <ul className="space-y-2">
                  {coupons.map((c) => {
                    const product = c.product_id ? products.find((p) => p.id === c.product_id) : null;
                    const productImg = product && Array.isArray(product.images) && product.images[0] ? product.images[0] : null;
                    const productLabel = product ? product.name : "All products";
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg border border-zinc-200 bg-zinc-50/50"
                      >
                        <span className="font-mono font-semibold text-black">{c.code}</span>
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded bg-zinc-100 shrink-0 overflow-hidden flex items-center justify-center">
                            {productImg ? (
                              <img src={productImg} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-zinc-400 text-[10px]">—</span>
                            )}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} DT`} — {productLabel}
                            {(c.starts_at || c.expires_at) && (
                              <CouponCountdown expiresAt={c.expires_at} startsAt={c.starts_at} />
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEditCoupon(c)}
                            className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded transition-colors"
                            aria-label="Edit coupon"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(c.id)}
                            disabled={deletingCouponId === c.id}
                            className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            aria-label="Delete coupon"
                          >
                            {deletingCouponId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline form on page (create or edit – no popup) */}
      {formOpen && (
        <div className="mb-6 sm:mb-8 bg-white rounded-xl border border-zinc-200 shadow-lg max-w-3xl w-full mx-auto">
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200">
            <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2 min-w-0">
              {editing ? (
                <>
                  <Pencil className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span className="truncate">Edit product{editing.name ? ` — ${editing.name}` : ""}</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span>New product</span>
                </>
              )}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="p-2 text-zinc-500 hover:text-black rounded shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-5">
            {/* Nom du produit * */}
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Product name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-500"
              />
            </div>

            {/* Prix *, Stock *, Sale price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1.5">
                  Price (DT) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="number-spin-design w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1.5">
                  Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="number-spin-design w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1.5">
                  Sale price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  placeholder="Price after discount"
                  className="number-spin-design w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
                {(() => {
                  const p = parseFloat(price);
                  const d = parseFloat(discountPrice);
                  if (p > 0 && !Number.isNaN(d) && d >= 0 && d < p) {
                    const percent = Math.round(((p - d) / p) * 100);
                    return <p className="mt-1 text-xs text-center text-red-600 font-medium">{percent} % off</p>;
                  }
                  return <p className="mt-1 text-xs text-zinc-500">Enter the original price first</p>;
                })()}
              </div>
            </div>

            {/* Catégorie * */}
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1.5">Couleur</label>
              <select
                value={colorId}
                onChange={(e) => {
                  const v = e.target.value;
                  setColorId(v);
                  if (v && v === colorId2) setColorId2("");
                }}
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">Selectionner une couleur</option>
                {colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">Couleur 2 (optionnel)</label>
              <select
                value={colorId2}
                onChange={(e) => setColorId2(e.target.value)}
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">Aucune</option>
                {colors.map((c) => (
                  <option key={`c2-${c.id}`} value={c.id} disabled={colorId === String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">Deuxième teinte (ex. bicolore) ; sur le site le client en choisit une.</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-y min-h-[96px] overflow-y-auto"
              />
            </div>

            {/* Size guide image */}
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Size guide image
              </label>
              <label className="flex items-center justify-center gap-2 w-full py-6 px-4 border-2 border-dashed border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors">
                <Upload className="h-5 w-5 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-600">
                  {sizeGuideUploading ? "Uploading…" : "Upload size guide image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={sizeGuideUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSizeGuideUploading(true);
                    setError(null);
                    try {
                      const url = await uploadSizeGuideImage(file);
                      setSizeGuideUrl(url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Size guide upload failed");
                    } finally {
                      setSizeGuideUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              {sizeGuideUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={sizeGuideUrl} alt="Guide tailles" className="h-12 w-auto rounded border object-cover" />
                  <button type="button" onClick={() => setSizeGuideUrl("")} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              )}
            </div>

            {/* Measurement table */}
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Measurement table
              </label>
              <div className="border border-zinc-300 rounded-lg overflow-hidden">
                <table className="text-xs w-full table-fixed">
                  <thead>
                    {measurementRows.length > 0 && (
                      <tr className="bg-zinc-100 border-b border-zinc-300">
                        {measurementRows[0].map((_, colIndex) => (
                          <th key={colIndex} className="text-left p-0 overflow-hidden align-top">
                            <div className="flex flex-row items-center gap-0.5 w-full min-w-0">
                              {measurementRows[0].length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMeasurementRows(measurementRows.map((row) => row.filter((_, i) => i !== colIndex)))
                                  }
                                  className="shrink-0 p-0.5 text-zinc-400 hover:text-red-600"
                                  aria-label={`Remove column ${colIndex + 1}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <input
                                type="text"
                                value={measurementRows[0][colIndex] ?? ""}
                                onChange={(e) => {
                                  const next = measurementRows.map((row, r) =>
                                    r === 0 ? row.map((c, i) => (i === colIndex ? e.target.value : c)) : row
                                  );
                                  setMeasurementRows(next);
                                }}
                                className="flex-1 min-w-0 bg-zinc-100 text-black px-1.5 py-1 border-r border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 text-[11px]"
                                placeholder="Column"
                              />
                            </div>
                          </th>
                        ))}
                        <th className="w-9 border-l border-zinc-300 bg-zinc-100" />
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {measurementRows.slice(1).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-zinc-300">
                        {row.map((cell, colIndex) => (
                          <td key={colIndex} className="p-0 border-r border-zinc-300 last:border-r-0">
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => {
                                const actualIndex = rowIndex + 1;
                                const next = measurementRows.map((row, rowIdx) =>
                                  rowIdx === actualIndex ? row.map((c, i) => (i === colIndex ? e.target.value : c)) : row
                                );
                                setMeasurementRows(next);
                              }}
                              className="w-full min-w-0 bg-white text-black px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-400 text-[11px]"
                            />
                          </td>
                        ))}
                        <td className="p-0 w-9 border-l border-zinc-300 align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              setMeasurementRows(measurementRows.filter((_, i) => i !== rowIndex + 1))
                            }
                            className="w-full py-1.5 text-zinc-400 hover:text-red-600"
                            aria-label="Remove row"
                          >
                            <Trash2 className="h-3.5 w-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const cols = measurementRows[0]?.length ?? 3;
                    setMeasurementRows([...measurementRows, Array(cols).fill("")]);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMeasurementRows(measurementRows.map((row) => [...row, ""]));
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add column
                </button>
              </div>
            </div>

            {/* Images du produit */}
            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Product images <span className="text-zinc-500 font-normal">(max 5 MB per image)</span>
              </label>
              <label className="flex items-center justify-center gap-2 w-full py-6 px-4 border-2 border-dashed border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors">
                <Upload className="h-5 w-5 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-600">
                  {productImagesUploading ? "Uploading…" : "Upload images (multiple)"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={productImagesUploading}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    setProductImagesUploading(true);
                    setError(null);
                    try {
                      for (let i = 0; i < files.length; i++) {
                        const url = await uploadProductImage(files[i]);
                        setProductImageUrls((prev) => [...prev, url]);
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Échec du téléchargement d’image");
                    } finally {
                      setProductImagesUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              {productImageUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {productImageUrls.map((url, i) => (
                    <div key={`${url}-${i}`} className="relative group">
                      <img
                        src={url}
                        alt=""
                        className={`h-14 w-14 rounded border object-cover ${i === 0 ? "ring-2 ring-black" : ""}`}
                      />
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-medium py-0.5 text-center rounded-b">
                          Main
                        </span>
                      )}
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setPrincipalProductImage(i)}
                          className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-medium py-0.5 flex items-center justify-center gap-0.5 rounded-b opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Définir comme image principale"
                        >
                          <Star className="h-3 w-3 fill-current" />
                          Main
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setProductImageUrls((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-zinc-500">The first image is the main image.</p>
              <button
                type="button"
                onClick={() => setShowUrlImages(!showUrlImages)}
                className="mt-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
              >
                {showUrlImages ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Or enter a URL
              </button>
              {showUrlImages && (
                <textarea
                  value={imagesStr}
                  onChange={(e) => setImagesStr(e.target.value)}
                  rows={2}
                  placeholder="One URL per line"
                  className="mt-2 w-full bg-white text-black text-xs border border-zinc-300 rounded-lg px-3 py-2 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              )}
            </div>

            {/* Available sizes */}
            <div>
              <label className="block text-xs font-medium text-black mb-2">Available sizes</label>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                      sizes.includes(size)
                        ? "border-black bg-black text-white"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-zinc-200">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:flex-1 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? "Save" : "Add"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="w-full sm:w-auto px-5 py-2.5 bg-white text-black text-sm font-semibold border-2 border-zinc-300 rounded-lg hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!formOpen && !discountOpen && !categoriesOpen && (
      <>
        {/* Mobile: card layout */}
        <div className="sm:hidden space-y-3">
          {products.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-zinc-500 text-sm">
              No products. Tap + to add one.
            </div>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 flex items-center gap-3"
              >
                <div className="h-14 w-14 rounded border border-zinc-200 overflow-hidden bg-zinc-100 shrink-0">
                  {normalizeProductImages(p.images)[0] ? (
                    <img src={normalizeProductImages(p.images)[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-400 text-xs">—</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black truncate">{p.name}</p>
                  <p className="text-sm text-zinc-600">
                    {p.discount_price != null ? (
                      <>
                        <span className="line-through text-zinc-400 mr-1">{p.price} DT</span>
                        <span className="font-medium text-black">{p.discount_price} DT</span>
                      </>
                    ) : (
                      <span>{p.price} DT</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleStock(p)}
                    disabled={togglingStockId === p.id}
                    className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                      isInStock(p) ? "bg-green-500" : "bg-red-500"
                    }`}
                    title={isInStock(p) ? "In stock" : "Out of stock"}
                    aria-label={isInStock(p) ? "In stock" : "Out of stock"}
                  >
                    {togglingStockId === p.id ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-3 w-3 text-white animate-spin" />
                      </span>
                    ) : (
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          isInStock(p) ? "left-5" : "left-1"
                        }`}
                      />
                    )}
                  </button>
                  <Link
                    href={`/collection/${encodeURIComponent(productPathSlug(p))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-zinc-500 hover:text-black rounded"
                    aria-label="View"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="p-2 text-zinc-500 hover:text-black rounded"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="p-2 text-zinc-500 hover:text-red-600 rounded disabled:opacity-50"
                    aria-label="Delete"
                  >
                    {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: table layout */}
      <div className="hidden sm:block rounded-lg border border-zinc-200 overflow-hidden bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-2 sm:px-4 py-2 sm:py-3 font-semibold uppercase tracking-wider text-zinc-600 min-w-[140px]">Product</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 font-semibold uppercase tracking-wider text-zinc-600">Price</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 font-semibold uppercase tracking-wider text-zinc-600 hidden sm:table-cell">Stock</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 font-semibold uppercase tracking-wider text-zinc-600 hidden md:table-cell">Category</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 font-semibold uppercase tracking-wider text-zinc-600 hidden md:table-cell">Couleur</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 font-semibold uppercase tracking-wider text-zinc-600 w-20 sm:w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No products. Click &quot;Add product&quot; to get started.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded border border-zinc-200 overflow-hidden bg-zinc-100 flex-shrink-0">
                        {normalizeProductImages(p.images)[0] ? (
                          <img src={normalizeProductImages(p.images)[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-zinc-400 text-xs">—</div>
                        )}
                      </div>
                      <span className="font-medium text-black truncate min-w-0">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-black whitespace-nowrap">
                    {p.discount_price != null ? (
                      <>
                        <span className="line-through text-zinc-400 mr-1">{p.price} DT</span>
                        <span>{p.discount_price} DT</span>
                      </>
                    ) : (
                      <span>{p.price} DT</span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell text-zinc-600">{p.stock}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell text-zinc-600">
                    {categories.find((c) => c.id === p.category_id)?.name ?? "—"}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-zinc-700 hidden md:table-cell">
                    <span className="inline-block max-w-[8rem] truncate align-middle" title={formatColorPair(p, colors)}>
                      {formatColorPair(p, colors)}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStock(p)}
                        disabled={togglingStockId === p.id}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          isInStock(p) ? "bg-green-500" : "bg-red-500"
                        }`}
                        title={isInStock(p) ? "In stock (click to set out of stock)" : "Out of stock (click to set in stock)"}
                        aria-label={isInStock(p) ? "In stock" : "Out of stock"}
                      >
                        {togglingStockId === p.id ? (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-3 w-3 text-white animate-spin" />
                          </span>
                        ) : (
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              isInStock(p) ? "left-4" : "left-0.5"
                            }`}
                          />
                        )}
                      </button>
                      <Link
                        href={`/collection/${encodeURIComponent(productPathSlug(p))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex p-1.5 text-zinc-500 hover:text-black transition-colors"
                        aria-label="View product"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-zinc-500 hover:text-black transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="p-1.5 text-zinc-500 hover:text-red-600 transition-colors disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

    </div>
  );
}
