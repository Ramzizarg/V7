/** Fired to play the V7 logo splash on client-side navigations (e.g. header logo → home). */
export const SPLASH_REQUEST_EVENT = "vero7-splash-request";

/** Fired when the full-page V7 splash animation has finished. */
export const SPLASH_DONE_EVENT = "vero7-splash-done";

/** Shows the same logo transition as a full page load without reloading. */
export function requestSplashTransition(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("vero7-splash-active");
  window.dispatchEvent(new Event(SPLASH_REQUEST_EVENT));
}
