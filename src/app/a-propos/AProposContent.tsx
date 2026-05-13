"use client";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function AProposContent() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-[860px] px-6 py-16 sm:px-8 lg:px-12">
        <h1 className="mb-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">
          A Propos De Vero7
        </h1>
        <p className="mb-10 text-sm text-neutral-500">
          Notre histoire, notre vision.
        </p>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Qui sommes-nous ?
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Vero7 est une marque tunisienne née de la passion du sport et du style urbain.
            Nous concevons des vêtements qui allient confort, performance et esthétique
            moderne — pour ceux qui vivent entre le terrain et la rue.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Notre Mission
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Offrir à la communauté tunisienne des pièces streetwear et sportswear de qualité,
            accessibles et pensées pour le quotidien. Chaque collection est conçue avec soin,
            en privilégiant des matières durables et un design qui vous ressemble.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Nos Valeurs
          </h2>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-700">
            <li>
              <strong>Qualité</strong> — Des matières sélectionnées et des finitions soignées pour des produits durables.
            </li>
            <li>
              <strong>Accessibilité</strong> — Un style premium à des prix justes, pour tous.
            </li>
            <li>
              <strong>Communauté</strong> — Vero7 grandit avec ses clients, ses athlètes et sa communauté.
            </li>
            <li>
              <strong>Authenticité</strong> — Créé en Tunisie, inspiré par la culture locale et le mouvement mondial.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Rejoignez-nous
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Suivez nos drops, nos événements et rejoignez le Club Vero7. Pour toute
            question ou collaboration, écrivez-nous à{" "}
            <a
              href="mailto:contact@vero-7.com"
              className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
            >
              contact@vero-7.com
            </a>
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
