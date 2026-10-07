"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Truck } from "lucide-react";
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import { setMetaAdvancedMatching, trackMetaInitiateCheckout, trackMetaPurchase } from "@/lib/metaPixel";
import { isValidTunisiaPhone, normalizeTunisiaPhoneDigits, TUNISIA_PHONE_LENGTH } from "@/lib/phoneValidation";
import { governorateLabel, TUNISIA_GOVERNORATES } from "@/lib/tunisiaGovernorates";
import type { CartItem, Product } from "@/lib/types";

const FREE_SHIPPING_FROM = 200;
const SHIPPING_FEE = 8;
const CUSTOMER_STORAGE_KEY = "vero7:quick-order-customer:v1";

type Customer = { fullName: string; phone: string; governorate: string; city: string; address: string };

const EMPTY_CUSTOMER: Customer = { fullName: "", phone: "", governorate: "", city: "", address: "" };

function loadCustomer(): Customer {
  if (typeof window === "undefined") return EMPTY_CUSTOMER;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (!raw) return EMPTY_CUSTOMER;
    const saved = JSON.parse(raw) as Partial<Customer>;
    return {
      fullName: typeof saved.fullName === "string" ? saved.fullName : "",
      phone: typeof saved.phone === "string" ? normalizeTunisiaPhoneDigits(saved.phone) : "",
      governorate: TUNISIA_GOVERNORATES.includes(saved.governorate ?? "") ? saved.governorate! : "",
      city: typeof saved.city === "string" ? saved.city : "",
      address: typeof saved.address === "string" ? saved.address : "",
    };
  } catch {
    return EMPTY_CUSTOMER;
  }
}

type Props = {
  product: Product;
  /** Selected size, or null when the customer has not picked one yet. */
  size: string | null;
  quantity: number;
  color?: string;
  onMissingSize: () => void;
};

const inputClass =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm";

export default function ProductQuickOrder({ product, size, quantity, color, onMissingSize }: Props) {
  const { t, formatMoney } = useTranslations();
  const [customer, setCustomer] = useState<Customer>(loadCustomer);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<{ id: number; total: number } | null>(null);
  const checkoutTracked = useRef(false);

  const unitPrice =
    product.discount_price != null && product.discount_price < product.price ? product.discount_price : product.price;
  const qty = Math.max(1, quantity);
  const subtotal = unitPrice * qty;
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  const cartItem = (): CartItem => ({
    productId: product.id,
    name: product.name,
    price: product.price,
    discountPrice: product.discount_price,
    image: product.images[0],
    size: size ?? undefined,
    color,
    quantity: qty,
  });

  const update = (field: keyof Customer, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const trackCheckoutOnce = () => {
    if (checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackMetaInitiateCheckout([cartItem()], total, { country: "tn" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (placing) return;
    setError(null);

    if (!size) {
      setError(t("product.selectSize"));
      onMissingSize();
      return;
    }
    const fullName = customer.fullName.trim();
    const phone = normalizeTunisiaPhoneDigits(customer.phone);
    const governorate = customer.governorate.trim();
    const city = customer.city.trim();
    const address = customer.address.trim();
    if (!fullName || !phone || !governorate || !city || !address) {
      setError(t("checkout.fillRequired"));
      return;
    }
    if (!isValidTunisiaPhone(phone)) {
      setError(t("checkout.phoneError"));
      return;
    }

    const item = cartItem();
    setPlacing(true);
    try {
      const res = await fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          address,
          city,
          governorate,
          discountAmount: 0,
          total,
          subtotal,
          shipping,
          items: [
            {
              productId: product.id,
              product_name: product.name,
              quantity: qty,
              price: unitPrice,
              size,
              color: color ?? null,
              image_url: product.images[0] ?? null,
            },
          ],
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; orderId?: number } | null;
      if (!res.ok) throw new Error(data?.error || t("checkout.orderError"));
      if (!data?.orderId) throw new Error(t("checkout.orderNotCreated"));

      const userData = { phone, fullName, city, state: governorate, country: "tn" };
      setMetaAdvancedMatching(userData);
      trackMetaPurchase(data.orderId, [item], total, userData);

      try {
        window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ fullName, phone, governorate, city, address }));
      } catch {
        /* storage unavailable */
      }
      setPlacedOrder({ id: data.orderId, total });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("checkout.orderError"));
    } finally {
      setPlacing(false);
    }
  };

  if (placedOrder) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-3 text-base font-bold text-black">
          {t("quickOrder.successTitle", { id: placedOrder.id })}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-700">{t("checkout.orderProcessDesc")}</p>
        <p className="mt-3 text-sm font-semibold text-black">
          {t("quickOrder.totalToPay", { total: formatMoney(placedOrder.total) })}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setPlacedOrder(null)}
            className="rounded-full border border-black bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-black hover:text-white"
          >
            {t("quickOrder.orderAgain")}
          </button>
          <Link
            href="/collection"
            className="rounded-full bg-black px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800"
          >
            {t("cart.continueShopping")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onFocus={trackCheckoutOnce}
      noValidate
      className="mt-6 rounded-2xl border-2 border-black p-3 sm:p-4"
      aria-labelledby="quick-order-title"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="quick-order-title"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-black"
        >
          <Truck className="h-4 w-4" aria-hidden />
          {t("quickOrder.title")}
        </h2>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
          {t("quickOrder.badge")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          type="text"
          autoComplete="name"
          value={customer.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          placeholder={t("quickOrder.fullName")}
          aria-label={t("checkout.fullName")}
          required
          className={inputClass}
        />
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={TUNISIA_PHONE_LENGTH}
          value={customer.phone}
          onChange={(e) => update("phone", normalizeTunisiaPhoneDigits(e.target.value))}
          placeholder={t("quickOrder.phone")}
          aria-label={t("checkout.phone")}
          required
          className={inputClass}
        />
        <span className="relative block min-w-0">
          <select
            value={customer.governorate}
            onChange={(e) => update("governorate", e.target.value)}
            autoComplete="address-level1"
            aria-label={t("checkout.governorate")}
            required
            className={`w-full cursor-pointer appearance-none truncate rounded-lg border border-zinc-300 bg-white py-2.5 pl-3 pr-8 text-[16px] focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm ${
              customer.governorate ? "text-black" : "text-zinc-400"
            }`}
          >
            <option value="" disabled>
              {t("checkout.governorate")}
            </option>
            {TUNISIA_GOVERNORATES.map((g) => (
              <option key={g} value={g} className="text-black">
                {governorateLabel(g)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
        </span>
        <input
          type="text"
          autoComplete="address-level2"
          value={customer.city}
          onChange={(e) => update("city", e.target.value)}
          placeholder={t("checkout.city")}
          aria-label={t("checkout.city")}
          required
          className={inputClass}
        />
        <input
          type="text"
          autoComplete="street-address"
          value={customer.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder={t("quickOrder.address")}
          aria-label={t("checkout.address")}
          required
          className={`${inputClass} col-span-2`}
        />
      </div>

      <div className="mt-3 space-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs">
        <div className="flex justify-between gap-3">
          <span className="min-w-0 truncate text-zinc-600">
            <span className={size ? "" : "font-semibold text-red-600"}>
              {size ? t("quickOrder.sizeLine", { size }) : t("quickOrder.noSize")}
            </span>
            {" × "}
            {qty}
          </span>
          <span className="shrink-0 text-black">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-zinc-600">{t("cart.shipping")}</span>
          <span className={shipping === 0 ? "font-medium text-emerald-700" : "text-black"}>
            {shipping === 0 ? t("quickOrder.freeShipping") : formatMoney(shipping)}
          </span>
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={placing}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-white transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
      >
        {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {placing ? t("quickOrder.placing") : t("quickOrder.submit", { total: formatMoney(total) })}
      </button>
    </form>
  );
}
