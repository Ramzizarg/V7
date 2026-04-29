/** Dispatched when a product is added to the wishlist (header can react). */
export const FAVORIS_ADDED_EVENT = "vero7-favoris-added";
export const CART_ADDED_EVENT = "vero7-cart-added";
export const CART_SIDEBAR_OPEN_EVENT = "vero7-cart-sidebar-open";

export function dispatchFavorisAdded(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FAVORIS_ADDED_EVENT));
}

export function dispatchCartAdded(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_ADDED_EVENT));
  window.dispatchEvent(new Event(CART_SIDEBAR_OPEN_EVENT));
}

/**
 * Flying thumbnail from an origin element toward the header favoris icon.
 * No-op if the target is missing (e.g. SSR or layout change).
 */
export function flyProductThumbnailToFavorites(originEl: HTMLElement | null, imageSrc: string): void {
  if (typeof document === "undefined" || !originEl || !imageSrc) return;
  const target = document.getElementById("site-header-favoris");
  if (!target) return;
  flyProductThumbnailToTarget(originEl, imageSrc, target);
}

export function flyProductThumbnailToCart(originEl: HTMLElement | null, imageSrc: string): void {
  if (typeof document === "undefined" || !originEl || !imageSrc) return;
  const target = document.getElementById("site-header-cart");
  if (!target) return;
  flyProductThumbnailToTarget(originEl, imageSrc, target);
}

function flyProductThumbnailToTarget(originEl: HTMLElement, imageSrc: string, target: HTMLElement): void {
  const from = originEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = 44;
  const el = document.createElement("div");
  el.setAttribute("role", "presentation");
  el.className =
    "pointer-events-none fixed z-[240] overflow-hidden rounded-full border-2 border-black bg-white shadow-lg";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${from.left + from.width / 2 - size / 2}px`;
  el.style.top = `${from.top + from.height / 2 - size / 2}px`;

  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = "";
  img.className = "h-full w-full object-cover";
  el.appendChild(img);
  document.body.appendChild(el);

  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  const tcx = to.left + to.width / 2;
  const tcy = to.top + to.height / 2;
  const dx = tcx - cx;
  const dy = tcy - cy;

  const anim = el.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0.88 },
    ],
    { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
  );
  anim.onfinish = () => el.remove();
}
