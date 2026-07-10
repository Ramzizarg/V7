import type { SiteLocale } from "@/lib/siteLocale";
import { en } from "./messages/en";
import { fr } from "./messages/fr";

export const MESSAGES = { fr, en } as const;
export type Messages = typeof fr;
export type MessageKey = string;

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function translate(
  messages: Messages,
  key: string,
  params?: Record<string, string | number>
): string {
  const value = getByPath(messages, key);
  if (typeof value !== "string") return key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (text, [paramKey, paramValue]) => text.replaceAll(`{${paramKey}}`, String(paramValue)),
    value
  );
}

export function getMessages(locale: SiteLocale): Messages {
  return MESSAGES[locale];
}

export function formatMoney(amount: number, locale: SiteLocale): string {
  const intlLocale = locale === "en" ? "en-TN" : "fr-FR";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function localeCompare(a: string, b: string, locale: SiteLocale): number {
  return a.localeCompare(b, locale === "en" ? "en" : "fr");
}

export function pluralArticles(count: number, locale: SiteLocale): string {
  if (locale === "en") return count > 1 ? "items" : "item";
  return count > 1 ? "articles" : "article";
}
