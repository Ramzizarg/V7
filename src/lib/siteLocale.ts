export type SiteLocale = "fr" | "en";

export const SITE_LOCALE_STORAGE_KEY = "vero7-locale";
export const SITE_LOCALE_EVENT = "vero7-locale";

export const LOCALE_LABELS: Record<SiteLocale, string> = {
  fr: "Français",
  en: "English",
};

export function getSiteLocale(): SiteLocale {
  if (typeof window === "undefined") return "fr";
  const stored = localStorage.getItem(SITE_LOCALE_STORAGE_KEY);
  return stored === "en" ? "en" : "fr";
}

export function applySiteLocale(locale: SiteLocale) {
  document.documentElement.lang = locale;
}

export function setSiteLocale(locale: SiteLocale) {
  localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
  applySiteLocale(locale);
  window.dispatchEvent(new CustomEvent(SITE_LOCALE_EVENT, { detail: locale }));
}
