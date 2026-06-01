import { Eye, Gift, Mail, Percent, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";

const CLUB_BENEFITS: { label: string; Icon: LucideIcon }[] = [
  { label: "10 % sur votre première commande", Icon: Percent },
  { label: "Cadeau d’anniversaire", Icon: Gift },
  { label: "Retour gratuit", Icon: RotateCcw },
  { label: "Aperçu produits", Icon: Eye },
  { label: "Offres spéciales", Icon: Sparkles },
  { label: "Newsletter hebdomadaire", Icon: Mail },
];

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
  return (
    <div className={className}>
      {CLUB_BENEFITS.map(({ label, Icon }) => (
        <div key={label} className={itemClassName}>
          <span className={iconWrapClassName} aria-hidden>
            <Icon className={iconClassName} strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1 pt-px leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}
