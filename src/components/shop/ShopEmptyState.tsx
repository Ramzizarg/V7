import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";

type Variant = "favoris" | "panier";

const copy: Record<
  Variant,
  { title: string; description: string; icon: typeof Heart; cta: string }
> = {
  favoris: {
    title: "Aucun favori pour l'instant",
    description:
      "Touchez le cœur sur une fiche produit pour enregistrer vos essentiels. Ils apparaissent ici, sur cet appareil.",
    icon: Heart,
    cta: "Découvrir la collection",
  },
  panier: {
    title: "Votre panier est vide",
    description:
      "Les articles que vous ajoutez depuis la boutique s'affichent ici. Prêt pour la prochaine session ?",
    icon: ShoppingBag,
    cta: "Compléter mon panier",
  },
};

type Props = { variant: Variant };

export function ShopEmptyState({ variant }: Props) {
  const { title, description, icon: Icon, cta } = copy[variant];

  return (
    <div className="relative mt-10 overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-b from-zinc-50 to-white shadow-[0_1px_0_0_rgba(0,0,0,0.04)] sm:mt-12">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-black/[0.03] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-zinc-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -18deg,
            transparent,
            transparent 10px,
            rgba(0, 0, 0, 0.02) 10px,
            rgba(0, 0, 0, 0.02) 11px
          )`,
        }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center px-5 py-14 text-center sm:px-10 sm:py-16 md:py-20">
        <div
          className="mb-7 flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full border border-black/10 bg-gradient-to-br from-white to-zinc-50 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-[6px] ring-black/[0.04] sm:h-[5.75rem] sm:w-[5.75rem]"
          aria-hidden
        >
          <Icon className="h-10 w-10 text-black sm:h-11 sm:w-11" strokeWidth={1.2} />
        </div>

        <h2 className="max-w-md text-xl font-semibold tracking-tight text-black sm:text-2xl">
          {title}
        </h2>
        <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-zinc-600 sm:text-[15px]">
          {description}
        </p>

        <div className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/collection"
            className="inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2"
          >
            {cta}
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-black/15 bg-white px-6 text-sm font-medium text-zinc-800 transition hover:border-black/30 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
