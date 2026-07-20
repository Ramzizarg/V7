/** Persists whether the first-visit -10% offer modal was dismissed or completed. */
export const WELCOME_OFFER_STORAGE_KEY = "vero7-welcome-offer";

export const WELCOME_OFFER_IMAGE_SRC = "/V7/10%25.webp";

export type WelcomeOfferStatus = "dismissed" | "subscribed";

export function getWelcomeOfferStatus(): WelcomeOfferStatus | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(WELCOME_OFFER_STORAGE_KEY);
  if (raw === "dismissed" || raw === "subscribed") return raw;
  return null;
}

export function setWelcomeOfferStatus(status: WelcomeOfferStatus): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WELCOME_OFFER_STORAGE_KEY, status);
}

export function shouldShowWelcomeOffer(): boolean {
  return getWelcomeOfferStatus() === null;
}
