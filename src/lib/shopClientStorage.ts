import type { CartItem } from "@/lib/types";

const WISHLIST_KEY = "vero7-wishlist-ids";
const CART_KEY = "vero7-cart";

function dispatch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("vero7-storage"));
  }
}

function readWishlist(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

function writeWishlistIds(ids: number[]) {
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n)))];
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(unique));
  dispatch();
}

export function getWishlistIds(): number[] {
  return readWishlist();
}

export function setWishlistIds(ids: number[]) {
  writeWishlistIds(ids);
}

/** Returns true if now in wishlist. */
export function toggleWishlistId(id: number): boolean {
  const s = new Set(readWishlist());
  const on = s.has(id);
  if (on) s.delete(id);
  else s.add(id);
  writeWishlistIds([...s]);
  return !on;
}

export function isWishlistId(id: number): boolean {
  return readWishlist().includes(id);
}

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter(
      (row): row is CartItem =>
        row &&
        typeof row === "object" &&
        "productId" in row &&
        "quantity" in row &&
        typeof (row as CartItem).productId === "number" &&
        typeof (row as CartItem).quantity === "number" &&
        typeof (row as CartItem).name === "string" &&
        typeof (row as CartItem).price === "number"
    );
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  dispatch();
}

export function getCart(): CartItem[] {
  return readCart();
}

export function setCart(items: CartItem[]) {
  writeCart(
    items
      .map((i) => ({ ...i, quantity: Math.max(0, Math.floor(i.quantity)) }))
      .filter((i) => i.quantity > 0)
  );
}

export function addToCart(item: Omit<CartItem, "quantity"> & { quantity?: number }): void {
  const q = item.quantity != null && item.quantity > 0 ? Math.floor(item.quantity) : 1;
  const list = readCart();
  const idx = list.findIndex(
    (l) =>
      l.productId === item.productId && (l.size ?? "") === (item.size ?? "") && (l.color ?? "") === (item.color ?? "")
  );
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], quantity: next[idx].quantity + q };
    writeCart(next);
  } else {
    writeCart([...list, { ...item, quantity: q, discountPrice: item.discountPrice ?? null }]);
  }
}

function sameLine(
  a: { productId: number; size?: string; color?: string },
  b: { productId: number; size?: string; color?: string }
) {
  return (
    a.productId === b.productId && (a.size ?? "") === (b.size ?? "") && (a.color ?? "") === (b.color ?? "")
  );
}

export function updateCartQuantity(
  key: { productId: number; size?: string; color?: string },
  quantity: number
) {
  const list = readCart();
  const next = list
    .map((l) => (sameLine(l, key) ? { ...l, quantity: Math.max(0, Math.floor(quantity)) } : l))
    .filter((l) => l.quantity > 0);
  writeCart(next);
}

export function removeFromCartLine(line: { productId: number; size?: string; color?: string }) {
  const list = readCart().filter(
    (l) =>
      l.productId !== line.productId ||
      (l.size ?? "") !== (line.size ?? "") ||
      (l.color ?? "") !== (line.color ?? "")
  );
  writeCart(list);
}

export function getCartItemCount(): number {
  return readCart().reduce((a, b) => a + b.quantity, 0);
}
