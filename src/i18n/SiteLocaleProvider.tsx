"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getSiteLocale,
  setSiteLocale as persistSiteLocale,
  SITE_LOCALE_EVENT,
  type SiteLocale,
} from "@/lib/siteLocale";
import { formatMoney, getMessages, localeCompare, pluralArticles, translate, type Messages } from "./translate";

type SiteLocaleContextValue = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  messages: Messages;
  formatMoney: (amount: number) => string;
  localeCompare: (a: string, b: string) => number;
  pluralArticles: (count: number) => string;
};

const SiteLocaleContext = createContext<SiteLocaleContextValue | null>(null);

export function SiteLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>("fr");

  useEffect(() => {
    setLocaleState(getSiteLocale());
    const onLocaleChange = () => setLocaleState(getSiteLocale());
    window.addEventListener(SITE_LOCALE_EVENT, onLocaleChange);
    return () => window.removeEventListener(SITE_LOCALE_EVENT, onLocaleChange);
  }, []);

  const setLocale = useCallback((next: SiteLocale) => {
    persistSiteLocale(next);
    setLocaleState(next);
  }, []);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const value = useMemo<SiteLocaleContextValue>(
    () => ({
      locale,
      setLocale,
      messages,
      t: (key, params) => translate(messages, key, params),
      formatMoney: (amount) => formatMoney(amount, locale),
      localeCompare: (a, b) => localeCompare(a, b, locale),
      pluralArticles: (count) => pluralArticles(count, locale),
    }),
    [locale, messages, setLocale]
  );

  return <SiteLocaleContext.Provider value={value}>{children}</SiteLocaleContext.Provider>;
}

export function useSiteLocale() {
  const ctx = useContext(SiteLocaleContext);
  if (!ctx) throw new Error("useSiteLocale must be used within SiteLocaleProvider");
  return ctx;
}

export function useTranslations() {
  const { t, locale, messages, formatMoney: fmt, localeCompare: cmp, pluralArticles: plural, setLocale } =
    useSiteLocale();
  return { t, locale, messages, formatMoney: fmt, localeCompare: cmp, pluralArticles: plural, setLocale };
}
