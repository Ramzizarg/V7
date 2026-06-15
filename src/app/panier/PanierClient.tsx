"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShopEmptyState } from "@/components/shop/ShopEmptyState";
import SiteHeader from "@/components/SiteHeader";
import { productPathSlug } from "@/lib/productUrl";
import { isProductListedForSale } from "@/lib/productListing";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import type { CartItem, Coupon, Product } from "@/lib/types";
import { addToCart, getCart, removeFromCartLine, setCart, updateCartQuantity } from "@/lib/shopClientStorage";
import { trackMetaInitiateCheckout, trackMetaPurchase, setMetaAdvancedMatching } from "@/lib/metaPixel";
import {
  isValidTunisiaPhone,
  normalizeTunisiaPhoneDigits,
  TUNISIA_PHONE_ERROR,
  TUNISIA_PHONE_LENGTH,
} from "@/lib/phoneValidation";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "STANDARD"] as const;
const TUNISIA_GOVERNORATES = [
  "Ariana", "Beja", "Ben Arous", "Bizerte", "Gabes", "Gafsa", "Jendouba",
  "Kairouan", "Kasserine", "Kebili", "Le Kef", "Mahdia", "Manouba", "Medenine",
  "Monastir", "Nabeul", "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tataouine",
  "Tozeur", "Tunis", "Zaghouan",
];

function useStorageTick() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = () => setN((x) => x + 1);
    window.addEventListener("vero7-storage", on);
    return () => window.removeEventListener("vero7-storage", on);
  }, []);
  return n;
}

function lineUnit(c: CartItem) {
  const d = c.discountPrice;
  if (d != null && d < c.price) return d;
  return c.price;
}

function lineSubtotal(c: CartItem) {
  return lineUnit(c) * c.quantity;
}

export default function PanierClient() {
  const tick = useStorageTick();
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quickAddProductId, setQuickAddProductId] = useState<number | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [saveInfo, setSaveInfo] = useState(false);
  const [governorateOpen, setGovernorateOpen] = useState(false);
  const [governorateQuery, setGovernorateQuery] = useState("");
  const governorateRef = useRef<HTMLDivElement>(null);
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderEmailWarning, setOrderEmailWarning] = useState<string | null>(null);
  const [showOrderProcessPopup, setShowOrderProcessPopup] = useState(false);

  useEffect(() => {
    setItems(getCart());
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ products?: Product[] }>)
      .then((d) => {
        if (cancelled) return;
        setProducts(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { subtotal, count } = useMemo(() => {
    const s = items.reduce((a, b) => a + lineSubtotal(b), 0);
    const c = items.reduce((a, b) => a + b.quantity, 0);
    return { subtotal: s, count: c };
  }, [items]);
  const shipping = subtotal >= 200 ? 0 : 8;
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const now = new Date().toISOString();
    if (appliedCoupon.starts_at && appliedCoupon.starts_at > now) return 0;
    if (appliedCoupon.expires_at && appliedCoupon.expires_at < now) return 0;
    if (!appliedCoupon.active) return 0;
    const applicableItems = appliedCoupon.product_id
      ? items.filter((i) => i.productId === appliedCoupon.product_id)
      : items;
    const applicableSubtotal = applicableItems.reduce((s, i) => s + (i.discountPrice ?? i.price) * i.quantity, 0);
    if (applicableSubtotal <= 0) return 0;
    if (appliedCoupon.discount_type === "percent") {
      return Math.min((applicableSubtotal * appliedCoupon.discount_value) / 100, applicableSubtotal);
    }
    return Math.min(appliedCoupon.discount_value, applicableSubtotal);
  }, [appliedCoupon, items]);
  const total = subtotal + shipping - discountAmount;

  const clear = useCallback(() => {
    setCart([]);
  }, []);

  const initiateCheckoutSent = useRef(false);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (governorateRef.current && !governorateRef.current.contains(e.target as Node)) {
        setGovernorateOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      initiateCheckoutSent.current = false;
      return;
    }
    if (initiateCheckoutSent.current) return;
    initiateCheckoutSent.current = true;
    trackMetaInitiateCheckout(items, total, {
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      fullName: fullName.trim() || undefined,
      city: city.trim() || undefined,
      state: governorate.trim() || undefined,
      country: "tn",
    });
  }, [items, total, email, phone, fullName, city, governorate]);

  useEffect(() => {
    const fn = fullName.trim();
    const em = email.trim();
    const ph = phone.trim();
    if (!fn && !em && !ph) return;
    const t = window.setTimeout(() => {
      setMetaAdvancedMatching({
        email: em || undefined,
        phone: ph || undefined,
        fullName: fn || undefined,
        city: city.trim() || undefined,
        state: governorate.trim() || undefined,
        country: "tn",
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [fullName, email, phone, city, governorate]);

  const suggestionProducts = useMemo(() => {
    const inCart = new Set(items.map((x) => x.productId));
    return products.filter((p) => !inCart.has(p.id) && isProductListedForSale(p)).slice(0, 8);
  }, [products, items]);

  const sortedSizesFor = (p: Product) => {
    const input = p.sizes?.filter((x) => typeof x === "string" && x.trim().length > 0);
    if (!input || input.length === 0) return ["STANDARD"];
    const order = new Map<string, number>(SIZE_ORDER.map((v, i) => [v, i]));
    return [...input].sort((a, b) => {
      const aa = a.trim().toUpperCase();
      const bb = b.trim().toUpperCase();
      const ia = order.get(aa);
      const ib = order.get(bb);
      if (ia != null && ib != null) return ia - ib;
      if (ia != null) return -1;
      if (ib != null) return 1;
      return aa.localeCompare(bb, "fr");
    });
  };

  const handlePlaceOrder = async () => {
    setOrderError(null);
    setOrderEmailWarning(null);
    const fn = fullName.trim();
    const em = email.trim();
    const ph = normalizeTunisiaPhoneDigits(phone);
    const gov = governorate.trim();
    const ct = city.trim();
    const addr = address.trim();
    if (!fn || !em || !ph || !gov || !ct || !addr) {
      setOrderError("Remplissez tous les champs requis.");
      return;
    }
    if (!isValidTunisiaPhone(ph)) {
      setOrderError(TUNISIA_PHONE_ERROR);
      return;
    }
    if (items.length === 0) {
      setOrderError("Votre panier est vide.");
      return;
    }
    setPlacingOrder(true);
    try {
      const minProcessingDelay = new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 2000);
      });

      const placeOrderRequest = fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fn,
          email: em,
          phone: ph,
          address: addr,
          city: ct,
          governorate: gov,
          couponCode: appliedCoupon ? coupon.trim() || null : null,
          discountAmount: discountAmount > 0 ? discountAmount : 0,
          total,
          subtotal,
          shipping,
          items: items.map((it) => ({
            productId: it.productId,
            product_name: it.name,
            quantity: it.quantity,
            price: it.discountPrice ?? it.price,
            size: it.size ?? null,
            color: it.color ?? null,
            image_url: it.image ?? null,
          })),
        }),
      });

      const [, res] = await Promise.all([minProcessingDelay, placeOrderRequest]);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        orderId?: number;
        emailsSent?: boolean;
        adminEmailSent?: boolean;
        clientEmailSent?: boolean;
        emailWarning?: string;
        adminError?: string;
        clientError?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error || "Impossible de confirmer la commande.");
      }

      const orderId = data?.orderId;
      if (!orderId) throw new Error("Commande non créée.");

      if (!data?.emailsSent) {
        const parts: string[] = [];
        if (!data?.adminEmailSent) parts.push("notification admin");
        if (!data?.clientEmailSent) parts.push("confirmation client");
        const resendDetail = [data?.adminError, data?.clientError]
          .filter((msg, i, arr) => typeof msg === "string" && msg.trim() && arr.indexOf(msg) === i)
          .join(" — ");
        setOrderEmailWarning(
          parts.length > 0
            ? resendDetail
              ? `Commande enregistrée, mais email(s) non envoyé(s) : ${parts.join(", ")}. ${resendDetail}`
              : `Commande enregistrée, mais email(s) non envoyé(s) : ${parts.join(", ")}. Vérifiez RESEND sur Vercel.`
            : data?.emailWarning || "Commande enregistrée, mais les emails n'ont pas pu être envoyés."
        );
      }

      trackMetaPurchase(orderId, items, total, {
        email: em,
        phone: ph,
        fullName: fn,
        city: ct,
        state: gov,
        country: "tn",
      });

      setCart([]);
      setOrderSuccess(true);
      setShowOrderProcessPopup(true);
      setFullName("");
      setEmail("");
      setPhone("");
      setGovernorate("");
      setGovernorateQuery("");
      setCity("");
      setAddress("");
      setCoupon("");
      setAppliedCoupon(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : "Impossible de confirmer la commande.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleApplyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setAppliedCoupon(null);
    try {
      const supabase = supabaseBrowserClient();
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      const c = (data ?? null) as Coupon | null;
      if (!c) {
        setCouponError("Code invalide ou expire.");
        return;
      }
      const now = new Date().toISOString();
      if (c.starts_at && c.starts_at > now) {
        setCouponError("Ce code n'est pas encore actif.");
        return;
      }
      if (c.expires_at && c.expires_at < now) {
        setCouponError("Ce code a expire.");
        return;
      }
      if (c.product_id && !items.some((i) => i.productId === c.product_id)) {
        setCouponError("Ce code ne s'applique a aucun produit du panier.");
        return;
      }
      setAppliedCoupon(c);
    } catch {
      setCouponError("Impossible de verifier le code.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <SiteHeader />
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-10 sm:pb-14">
        <div className="mb-4 sm:mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Panier</p>
          <h1 className="text-xl sm:text-3xl font-semibold mt-0.5 sm:mt-1 text-black">Confirmation commande</h1>
        </div>

        {items.length === 0 ? (
          <ShopEmptyState variant="panier" />
        ) : (
          <div className="grid gap-6 sm:gap-10 lg:grid-cols-[1fr_420px] lg:gap-16 min-w-0">
            <section className="space-y-4 sm:space-y-6 bg-white min-w-0">
              <form className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-black mb-1">Nom complet</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex. Ahmed Ben Ali"
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-3 sm:py-2.5 text-[16px] sm:text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-black mb-1">
                    Email <span className="text-zinc-400 font-normal">(confirmation de commande)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemple@email.com"
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-3 sm:py-2.5 text-[16px] sm:text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-black mb-1">
                    Numero de telephone <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    minLength={TUNISIA_PHONE_LENGTH}
                    maxLength={TUNISIA_PHONE_LENGTH}
                    pattern="[0-9]{8}"
                    value={phone}
                    onChange={(e) => setPhone(normalizeTunisiaPhoneDigits(e.target.value))}
                    placeholder="12345678"
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-3 sm:py-2.5 text-[16px] sm:text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">8 chiffres obligatoires (ex. 20123456)</p>
                </div>
                <div ref={governorateRef} className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-black mb-1">Gouvernorat</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={governorateOpen ? governorateQuery : governorate}
                      onChange={(e) => {
                        setGovernorateQuery(e.target.value);
                        setGovernorateOpen(true);
                        if (!e.target.value) setGovernorate("");
                      }}
                      onFocus={() => {
                        setGovernorateOpen(true);
                        setGovernorateQuery(governorate);
                      }}
                      placeholder="Rechercher ou selectionner un gouvernorat"
                      className="w-full bg-white border border-zinc-300 rounded-lg pl-3 pr-10 py-3 sm:py-2.5 text-[16px] sm:text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">⌄</span>
                  </div>
                  {governorateOpen ? (
                    <ul className="absolute z-10 mt-1 left-0 right-0 max-h-56 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                      {TUNISIA_GOVERNORATES.filter((g) =>
                        g.toLowerCase().includes(governorateQuery.toLowerCase().trim())
                      ).map((g) => (
                        <li
                          key={g}
                          onClick={() => {
                            setGovernorate(g);
                            setGovernorateQuery("");
                            setGovernorateOpen(false);
                          }}
                          className={`cursor-pointer px-3 py-2.5 text-sm hover:bg-zinc-100 ${
                            governorate === g ? "bg-zinc-50 font-medium text-black" : "text-black"
                          }`}
                        >
                          {g}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-black mb-1">Ville</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Tunis, Sfax"
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-3 sm:py-2.5 text-[16px] sm:text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-black mb-1">Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rue, numero, code postal"
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-3 sm:py-2.5 text-[16px] sm:text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveInfo}
                    onChange={(e) => setSaveInfo(e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded border-2 border-zinc-300 bg-white accent-black"
                  />
                  <span className="text-xs sm:text-sm text-black">Enregistrer ces informations pour la prochaine fois</span>
                </label>
              </form>
            </section>

            <aside className="lg:sticky lg:top-24 h-fit">
              <div className="border border-zinc-200 rounded-xl p-5 sm:p-6" style={{ backgroundColor: "#f5f5f5" }}>
                <h2 className="text-lg font-semibold text-black mb-4">Recapitulatif commande</h2>
                <ul className="space-y-3 mb-4 pb-4 border-b border-zinc-200">
                  {items.map((item, index) => (
                    <li key={`${item.productId}-${item.size ?? ""}-${index}`} className="flex gap-3">
                      <div className="w-14 h-14 rounded border border-zinc-200 overflow-hidden bg-zinc-100 shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">—</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">{item.name}</p>
                        {(item.size || item.color) ? (
                          <p className="text-xs text-zinc-500">{[item.size, item.color].filter(Boolean).join(" / ")}</p>
                        ) : null}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-black">
                          {((item.discountPrice ?? item.price) * item.quantity).toFixed(2)} DT
                        </p>
                        <p className="text-xs text-zinc-500">× {item.quantity}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={coupon}
                      onChange={(e) => {
                        setCoupon(e.target.value);
                        setCouponError(null);
                      }}
                      placeholder="Code promo"
                      className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-black placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-medium text-black hover:bg-zinc-50 shrink-0"
                    >
                      Appliquer
                    </button>
                  </div>
                  {couponError ? <p className="text-xs text-red-600 mt-1">{couponError}</p> : null}
                  {appliedCoupon ? (
                    <p className="text-xs text-green-600 mt-1">Code {appliedCoupon.code} applied (−{discountAmount.toFixed(2)} DT)</p>
                  ) : null}
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-zinc-600">Sous-total</span><span className="text-black">{subtotal.toFixed(2)} DT</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Livraison</span><span className="text-black">{shipping.toFixed(2)} DT</span></div>
                  {discountAmount > 0 ? (
                    <div className="flex justify-between text-green-600"><span>Remise</span><span>−{discountAmount.toFixed(2)} DT</span></div>
                  ) : null}
                  <div className="flex justify-between font-semibold text-black pt-2 border-t border-zinc-200">
                    <span>Total</span><span>{total.toFixed(2)} DT</span>
                  </div>
                </div>

                {orderError ? <p className="text-sm text-red-600 mb-3">{orderError}</p> : null}
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={placingOrder}
                  className="relative w-full py-4 sm:py-3.5 bg-black text-white text-sm font-semibold uppercase tracking-wider rounded-lg hover:bg-zinc-800 transition-colors disabled:cursor-not-allowed overflow-hidden"
                >
                  <span className={`inline-flex items-center transition-all duration-300 ${placingOrder ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                    PAYER EN ESPECES
                  </span>
                  {placingOrder && (
                    <span className="absolute inset-0 flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white animate-[dotBounce_1.2s_ease-in-out_infinite]" />
                      <span className="h-2 w-2 rounded-full bg-white animate-[dotBounce_1.2s_ease-in-out_0.2s_infinite]" />
                      <span className="h-2 w-2 rounded-full bg-white animate-[dotBounce_1.2s_ease-in-out_0.4s_infinite]" />
                    </span>
                  )}
                </button>
                <p className="text-xs text-zinc-500 mt-2 text-center px-1">
                  Paiement a la livraison (especes uniquement). Pas de PayPal.
                </p>
                <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500 justify-center sm:justify-start">
                  <Link href="/refund-policy" className="hover:text-black py-1">Politique de remboursement</Link>
                  <Link href="/shipping-terms" className="hover:text-black py-1">Livraison</Link>
                  <Link href="/privacy-policy" className="hover:text-black py-1">Confidentialite</Link>
                  <Link href="/terms-of-service" className="hover:text-black py-1">Conditions de service</Link>
                </div>
              </div>
            </aside>
          </div>
        )}
        {orderSuccess ? (
          <p className="mx-auto mt-6 max-w-5xl rounded bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            Commande envoyee avec succes. Nous vous contacterons bientot.
          </p>
        ) : null}
        {orderEmailWarning ? (
          <p className="mx-auto mt-3 max-w-5xl rounded bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {orderEmailWarning}
          </p>
        ) : null}

        {suggestionProducts.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-4xl font-black tracking-tight text-black">Vous aimerez aussi</h2>
            <div className="mt-6 overflow-x-auto">
              <div className="flex min-w-max gap-3 sm:gap-4">
                {suggestionProducts.map((p) => {
                  const src = p.images[0] ?? "/vero7-logo.png";
                  const list = p.discount_price != null && p.discount_price < p.price ? p.price : null;
                  const sale = p.discount_price != null && p.discount_price < p.price ? p.discount_price : p.price;
                  return (
                    <article key={p.id} className="group relative w-[145px] text-left sm:w-[180px]">
                      <Link href={`/collection/${encodeURIComponent(productPathSlug(p))}`} className="block">
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100">
                          <Image
                            src={src}
                            alt={p.name}
                            fill
                            sizes="180px"
                            className="object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                          />
                          <button
                            type="button"
                            aria-label="Ajouter au panier"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setQuickAddProductId((prev) => (prev === p.id ? null : p.id));
                            }}
                            className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center border border-black/10 bg-white text-lg font-light leading-none text-black shadow-sm transition hover:bg-zinc-50"
                          >
                            +
                          </button>
                          {quickAddProductId === p.id ? (
                            <div
                              className="absolute inset-x-2 bottom-12 z-20 rounded-md border border-black/10 bg-white p-2 shadow-lg"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                                Taille du produit
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {sortedSizesFor(p).map((sz) => (
                                  <button
                                    key={`${p.id}-${sz}`}
                                    type="button"
                                    onClick={() => {
                                      addToCart({
                                        productId: p.id,
                                        name: p.name,
                                        price: p.price,
                                        discountPrice: p.discount_price,
                                        image: src,
                                        size: sz,
                                        color: p.color ?? undefined,
                                        quantity: 1,
                                      });
                                      setQuickAddProductId(null);
                                    }}
                                    className="min-w-[2.2rem] border border-black/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black transition hover:border-black/40"
                                  >
                                    {sz}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <p className="mt-3 text-[30px] leading-none text-black">
                          {sale.toFixed(2)} DT
                        </p>
                        {list != null ? (
                          <p className="mt-1 text-xs text-zinc-400 line-through">{list.toFixed(2)} DT</p>
                        ) : null}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      {showOrderProcessPopup ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 sm:p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-black">Commande en cours ✅</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              Votre commande est en cours de traitement. Le service client va vous appeler pour confirmer la
              commande.
            </p>
            <Link
              href="/collection"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-800"
            >
              Continuer vos achats
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
