"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { shouldBypassImageOptimization } from "@/lib/imageOptimize";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

export type MegaMenuKey = "hommes" | "femmes";

type Props = {
  active: MegaMenuKey;
  featuredImages: string[];
  onClose: () => void;
};

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

export default function HeaderMegaMenu({ active, featuredImages, onClose }: Props) {
  const { t } = useTranslations();
  const primaryImage = featuredImages[0] ?? "/vero7-logo.webp";
  const secondaryImage = featuredImages[1] ?? featuredImages[0] ?? "/vero7-logo.webp";
  const linkKeys = MEGA_LINK_KEYS[active];

  return (
    <div className="px-4 lg:px-6 xl:px-10">
      <div className="grid min-h-[22rem] w-full max-w-[58rem] grid-cols-[minmax(11rem,14rem)_1fr] xl:max-w-[62rem] xl:grid-cols-[minmax(12rem,15rem)_1fr]">
        <nav
          className="flex flex-col border-r border-black/10 py-6 pr-4"
          aria-label={active === "hommes" ? t("megaMenu.menuHomme") : t("megaMenu.menuFemme")}
        >
          <ul className="space-y-0.5">
            {linkKeys.map((key) => (
              <li key={key}>
                <Link
                  href="/collection"
                  onClick={onClose}
                  className="group flex items-center justify-between gap-3 rounded-md py-2.5 pr-1 text-sm font-medium text-black transition hover:bg-zinc-50"
                >
                  <span>{t(key)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-black" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-6">
          <Link
            href="/collection"
            onClick={onClose}
            className="group relative min-h-[14rem] overflow-hidden bg-zinc-100 sm:min-h-[18rem]"
          >
            <Image
              src={primaryImage}
              alt=""
              fill
              sizes="(max-width: 1280px) 40vw, 480px"
              unoptimized={shouldBypassImageOptimization(primaryImage)}
              className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <span className="absolute bottom-5 left-5 text-lg font-bold uppercase tracking-[0.14em] text-white sm:bottom-6 sm:left-6 sm:text-xl">
              {t("megaMenu.nouveautes")}
            </span>
          </Link>
          <Link
            href="/collection"
            onClick={onClose}
            className="group relative min-h-[14rem] overflow-hidden bg-zinc-100 sm:min-h-[18rem]"
          >
            <Image
              src={secondaryImage}
              alt=""
              fill
              sizes="(max-width: 1280px) 40vw, 480px"
              unoptimized={shouldBypassImageOptimization(secondaryImage)}
              className="object-cover object-top transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
            <span className="absolute bottom-5 left-5 text-lg font-bold uppercase tracking-[0.14em] text-white sm:bottom-6 sm:left-6 sm:text-xl">
              {t("megaMenu.collection")}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
