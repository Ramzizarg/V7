"use client";

import { Eye, Gift, Mail, Percent, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

const BENEFIT_KEYS = [
  "club.benefit1",
  "club.benefit2",
  "club.benefit3",
  "club.benefit4",
  "club.benefit5",
  "club.benefit6",
] as const;

const BENEFIT_ICONS: LucideIcon[] = [Percent, Gift, RotateCcw, Eye, Sparkles, Mail];

type Props = {
  className?: string;
  itemClassName?: string;
  iconWrapClassName?: string;
  iconClassName?: string;
};

export function ClubBenefitsList({
  className = "grid grid-cols-1 gap-3 text-black sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4",
  itemClassName = "flex min-h-8 items-center gap-3 text-sm font-semibold uppercase leading-tight sm:text-base",
  iconWrapClassName = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/25 bg-zinc-50 text-black",
  iconClassName = "h-4 w-4",
}: Props) {
  const { t } = useTranslations();

  return (
    <div className={className}>
      {BENEFIT_KEYS.map((key, i) => {
        const Icon = BENEFIT_ICONS[i]!;
        return (
          <div key={key} className={itemClassName}>
            <span className={iconWrapClassName} aria-hidden>
              <Icon className={iconClassName} strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 pt-px leading-tight">{t(key)}</span>
          </div>
        );
      })}
    </div>
  );
}
