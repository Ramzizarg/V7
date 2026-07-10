"use client";

import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { type MegaMenuKey } from "@/components/HeaderMegaMenu";
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import { LOCALE_LABELS, type SiteLocale } from "@/lib/siteLocale";

type Props = {
  open: boolean;
  onClose: () => void;
};

type SecondaryNavItem = {
  id: string;
  labelKey: string;
  linkKeys: string[];
};

const SECONDARY_NAV_ITEMS: SecondaryNavItem[] = [
  {
    id: "unisexe",
    labelKey: "nav.unisexe",
    linkKeys: ["nav.lifestyle", "mobileNav.essentials", "mobileNav.nouveautes"],
  },
  {
    id: "accessoires",
    labelKey: "nav.accessoires",
    linkKeys: ["mobileNav.allAccessories", "mobileNav.sport", "nav.lifestyle"],
  },
  {
    id: "promo",
    labelKey: "nav.promo",
    linkKeys: ["mobileNav.nouveautes", "mobileNav.lastChance"],
  },
];

const MEGA_LINK_KEYS: Record<MegaMenuKey, string[]> = {
  hommes: [
    "megaMenu.tendances",
    "megaMenu.produits",
    "megaMenu.sport",
    "megaMenu.accessoires",
    "megaMenu.derniereChance",
  ],
  femmes: [
    "megaMenu.tendances",
    "megaMenu.produits",
    "megaMenu.lifestyle",
    "megaMenu.accessoires",
    "megaMenu.derniereChance",
  ],
};

const LOCALE_OPTIONS: SiteLocale[] = ["fr", "en"];

export function MobileNavSidebar({ open, onClose }: Props) {
  const { t, locale, setLocale } = useTranslations();
  const [mounted, setMounted] = useState(false);
  const [gender, setGender] = useState<MegaMenuKey>("femmes");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  const genderLinks = useMemo(
    () => MEGA_LINK_KEYS[gender].map((key) => ({ label: t(key), href: "/collection" })),
    [gender, t]
  );

  const secondaryItems = useMemo(
    () =>
      SECONDARY_NAV_ITEMS.map((item) => ({
        ...item,
        label: t(item.labelKey),
        links: item.linkKeys.map((key) => ({ label: t(key), href: "/collection" })),
      })),
    [t]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setExpandedId(null);
      setLangOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[115] bg-black/40 backdrop-blur-[4px] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-[116] flex h-dvh w-[min(82vw,340px)] flex-col bg-white text-black shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.mobileNav")}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 py-5">
          <Link
            href="/"
            onClick={onClose}
            className="text-[1.35rem] font-bold italic leading-none tracking-tight text-black"
          >
            Vero7
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            aria-label={t("nav.closeMenu")}
          >
            <X className="h-6 w-6" strokeWidth={1.75} />
          </button>
        </div>

        <div className="shrink-0 border-b border-black/10 px-5 py-4">
          <div
            role="group"
            aria-label={t("nav.mobileNav")}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              aria-pressed={gender === "femmes"}
              onClick={() => setGender("femmes")}
              className={`rounded-full px-3.5 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                gender === "femmes"
                  ? "bg-black text-white"
                  : "bg-zinc-100 text-black hover:bg-zinc-200/80"
              }`}
            >
              {t("nav.femme")}
            </button>
            <button
              type="button"
              aria-pressed={gender === "hommes"}
              onClick={() => setGender("hommes")}
              className={`rounded-full px-3.5 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                gender === "hommes"
                  ? "bg-black text-white"
                  : "bg-zinc-100 text-black hover:bg-zinc-200/80"
              }`}
            >
              {t("nav.homme")}
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label={t("nav.mobileNav")}>
          <ul className="border-b border-black/10 px-5 py-2">
            {genderLinks.map((link) => (
              <li key={`${gender}-${link.label}`}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block py-3 text-sm font-medium text-black transition hover:text-zinc-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <ul>
            {secondaryItems.map((item) => {
              const isExpanded = expandedId === item.id;

              return (
                <li key={item.id} className="border-b border-black/10">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold italic uppercase tracking-[0.06em] text-black transition hover:bg-zinc-50"
                  >
                    {item.label}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      strokeWidth={2}
                    />
                  </button>
                  {isExpanded ? (
                    <ul className="border-t border-black/5 bg-zinc-50 px-5 pb-2 pt-1">
                      {item.links.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            onClick={onClose}
                            className="block py-2.5 text-sm font-medium text-zinc-600 transition hover:text-black"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-black/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            aria-expanded={langOpen}
            onClick={() => setLangOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-zinc-50"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              {t("nav.language")}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-black">
              {LOCALE_LABELS[locale]}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
            </span>
          </button>
          {langOpen ? (
            <div className="border-t border-black/5 px-5 py-2">
              {LOCALE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`block w-full py-2.5 text-left text-sm font-medium transition ${
                    locale === option ? "text-black" : "text-zinc-400 hover:text-zinc-700"
                  }`}
                  onClick={() => {
                    setLocale(option);
                    setLangOpen(false);
                  }}
                >
                  {LOCALE_LABELS[option]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
    </>,
    document.body
  );
}
