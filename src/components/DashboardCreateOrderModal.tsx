"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import {
  isValidTunisiaPhone,
  normalizeTunisiaPhoneDigits,
  TUNISIA_PHONE_ERROR,
  TUNISIA_PHONE_LENGTH,
} from "@/lib/phoneValidation";
import { getSizeOptionsForProduct } from "@/lib/productSizesDisplay";
import { stockForSize, parseSizeStocks } from "@/lib/productSizeStock";
import type { Product } from "@/lib/types";

const TUNISIA_GOVERNORATES = [
  "Ariana",
  "Beja",
  "Ben Arous",
  "Bizerte",
  "Gabes",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Le Kef",
  "Mahdia",
  "Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;

type DraftLine = {
  key: string;
  productId: number;
  name: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  image: string | null;
  maxStock: number;
};

function unitPrice(p: Product): number {
  if (p.discount_price != null && p.discount_price < p.price) return Number(p.discount_price);
  return Number(p.price);
}

function productImage(p: Product): string | null {
  const imgs = Array.isArray(p.images) ? p.images : [];
  return typeof imgs[0] === "string" ? imgs[0] : null;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
  }).format(n);
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function DashboardCreateOrderModal({ open, onClose, onCreated }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickProductId, setPickProductId] = useState("");
  const [pickSize, setPickSize] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [freeShipping, setFreeShipping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      setFormError(null);
      try {
        const supabase = supabaseBrowserClient();
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("name", { ascending: true });
        if (error) throw error;
        if (!cancelled) setProducts((data ?? []) as Product[]);
      } catch (e) {
        if (!cancelled) setFormError(e instanceof Error ? e.message : "Impossible de charger les produits");
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCity("");
    setGovernorate("");
    setLines([]);
    setPickProductId("");
    setPickSize("");
    setPickQty("1");
    setFreeShipping(false);
    setFormError(null);
  }, [open]);

  const pickProduct = useMemo(
    () => products.find((p) => String(p.id) === pickProductId) ?? null,
    [products, pickProductId]
  );

  const pickSizeOptions = useMemo(() => {
    if (!pickProduct) return [];
    return getSizeOptionsForProduct(pickProduct).filter((o) => o.available);
  }, [pickProduct]);

  useEffect(() => {
    if (!pickProduct) {
      setPickSize("");
      return;
    }
    const first = pickSizeOptions[0]?.label ?? "";
    setPickSize((prev) => (pickSizeOptions.some((o) => o.label === prev) ? prev : first));
  }, [pickProduct, pickSizeOptions]);

  const pickMax = useMemo(() => {
    if (!pickProduct || !pickSize) return 0;
    return stockForSize(parseSizeStocks(pickProduct.sizes ?? null, pickProduct.stock), pickSize, pickProduct.stock);
  }, [pickProduct, pickSize]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [lines]
  );
  const shipping = freeShipping || subtotal >= 200 ? 0 : 8;
  const total = subtotal + shipping;

  const addLine = () => {
    setFormError(null);
    if (!pickProduct || !pickSize) {
      setFormError("Choisissez un produit et une taille.");
      return;
    }
    const qty = Math.max(1, Math.floor(Number(pickQty) || 0));
    if (qty < 1) {
      setFormError("Quantité invalide.");
      return;
    }
    if (qty > pickMax) {
      setFormError(`Stock insuffisant pour ${pickSize} (max ${pickMax}).`);
      return;
    }
    const color =
      [pickProduct.color, pickProduct.color_2]
        .map((c) => (typeof c === "string" ? c.trim() : ""))
        .filter(Boolean)
        .join(" & ") || "";
    const price = unitPrice(pickProduct);
    setLines((prev) => {
      const existing = prev.find(
        (l) => l.productId === pickProduct.id && l.size.toUpperCase() === pickSize.toUpperCase()
      );
      if (existing) {
        const nextQty = existing.quantity + qty;
        if (nextQty > pickMax) {
          setFormError(`Stock insuffisant pour ${pickSize} (max ${pickMax}).`);
          return prev;
        }
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: nextQty } : l));
      }
      return [
        ...prev,
        {
          key: `${pickProduct.id}-${pickSize}-${Date.now()}`,
          productId: Number(pickProduct.id),
          name: pickProduct.name,
          price,
          size: pickSize,
          color,
          quantity: qty,
          image: productImage(pickProduct),
          maxStock: pickMax,
        },
      ];
    });
    setPickQty("1");
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const updateLineQty = (key: string, raw: string) => {
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(n, l.maxStock) } : l))
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const fn = fullName.trim();
    const em = email.trim();
    const ph = normalizeTunisiaPhoneDigits(phone);
    const addr = address.trim();
    const ct = city.trim();
    const gov = governorate.trim();
    if (!fn || !em || !ph || !addr || !ct || !gov) {
      setFormError("Remplissez tous les champs client.");
      return;
    }
    if (!isValidTunisiaPhone(ph)) {
      setFormError(TUNISIA_PHONE_ERROR);
      return;
    }
    if (lines.length === 0) {
      setFormError("Ajoutez au moins un produit.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fn,
          email: em,
          phone: ph,
          address: addr,
          city: ct,
          governorate: gov,
          couponCode: null,
          discountAmount: 0,
          total,
          subtotal,
          shipping,
          items: lines.map((it) => ({
            productId: Number(it.productId),
            product_name: it.name,
            quantity: Number(it.quantity),
            price: Number(it.price),
            size: it.size,
            color: it.color || null,
            image_url: it.image,
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; orderId?: number } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Création de commande impossible.");
      }
      onCreated();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Créer une commande"
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-black">Créer une commande</h2>
            <p className="text-xs text-zinc-500">Pour n’importe quel client · stock déduit automatiquement</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-black"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Client</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-black sm:col-span-2">
                  Nom complet
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Téléphone (8 chiffres)
                  <input
                    required
                    inputMode="numeric"
                    maxLength={TUNISIA_PHONE_LENGTH}
                    value={phone}
                    onChange={(e) => setPhone(normalizeTunisiaPhoneDigits(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black sm:col-span-2">
                  Adresse
                  <input
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Ville
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  />
                </label>
                <label className="block text-xs font-medium text-black">
                  Gouvernorat
                  <select
                    required
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                  >
                    <option value="">Sélectionner</option>
                    {TUNISIA_GOVERNORATES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Produits</h3>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                  <label className="block text-xs font-medium text-black">
                    Produit
                    <select
                      value={pickProductId}
                      onChange={(e) => setPickProductId(e.target.value)}
                      disabled={loadingProducts}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                    >
                      <option value="">{loadingProducts ? "Chargement…" : "Choisir"}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatMoney(unitPrice(p))} (stock {p.stock})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-black">
                    Taille
                    <select
                      value={pickSize}
                      onChange={(e) => setPickSize(e.target.value)}
                      disabled={!pickProduct || pickSizeOptions.length === 0}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15"
                    >
                      {pickSizeOptions.length === 0 ? (
                        <option value="">—</option>
                      ) : (
                        pickSizeOptions.map((o) => (
                          <option key={o.label} value={o.label}>
                            {o.label} ({o.stock})
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-black">
                    Qté
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, pickMax)}
                      value={pickQty}
                      onChange={(e) => setPickQty(e.target.value)}
                      className="number-spin-design mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/15 sm:w-20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addLine}
                    disabled={!pickProduct || !pickSize || pickMax < 1}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                </div>
                {pickProduct && pickSizeOptions.length === 0 ? (
                  <p className="text-xs text-red-600">Ce produit n’a plus de stock par taille.</p>
                ) : null}
              </div>

              {lines.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucun article ajouté.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {lines.map((l) => (
                    <li key={l.key} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100">
                        {l.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.image} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-black">{l.name}</p>
                        <p className="text-xs text-zinc-500">
                          {l.size}
                          {l.color ? ` · ${l.color}` : ""} · {formatMoney(l.price)}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={l.maxStock}
                        value={l.quantity}
                        onChange={(e) => updateLineQty(l.key, e.target.value)}
                        className="number-spin-design w-16 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-black"
                        aria-label={`Quantité ${l.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="rounded-full p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Sous-total</span>
                <span className="font-medium text-black">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Livraison</span>
                <span className="font-medium text-black">{formatMoney(shipping)}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={(e) => setFreeShipping(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Livraison offerte (commande manuelle)
              </label>
              <div className="flex justify-between border-t border-zinc-100 pt-2 text-base font-bold text-black">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || lines.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Créer la commande
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
