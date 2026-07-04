"use client";

import CustomerServiceLayout from "@/components/CustomerServiceLayout";

const INSTAGRAM_URL = "https://www.instagram.com/vero7.tn/";
const CONTACT_EMAIL = "contact@vero-7.com";
const CONTACT_PHONE = "+216 25 191 292";
const CONTACT_PHONE_HREF = "tel:+21625191292";
const BUSINESS_HOURS = "Lundi – Vendredi / 9h30 - 13h00 – 14h00 - 17h30";

function ContactSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 p-6 sm:p-8">
      <h3 className="mb-4 text-lg font-bold uppercase tracking-wide">{title}</h3>
      <div className="text-sm leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export default function ContactContent() {
  return (
    <CustomerServiceLayout
      title="Contact"
      subtitle={
        <>
          Nous nous engageons à vous offrir le meilleur service possible. Si vous souhaitez
          nous contacter pour une question ou une suggestion, choisissez l&apos;une des options
          ci-dessous :
        </>
      }
    >
      <div className="space-y-6">
        <ContactSection title="Réseaux sociaux">
          <p>
            Écrivez-nous sur Instagram via{" "}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
            >
              @vero7.tn
            </a>
            . Notre équipe vous répondra dans les meilleurs délais.
          </p>
          <p className="mt-3 text-neutral-500">{BUSINESS_HOURS}</p>
        </ContactSection>

        <ContactSection title="Envoyez-nous un e-mail">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="mt-3">Nous vous répondrons dans les plus brefs délais.</p>
        </ContactSection>

        <ContactSection title="Appelez-nous">
          <a
            href={CONTACT_PHONE_HREF}
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            {CONTACT_PHONE}
          </a>
          <span className="text-neutral-500"> (Tunisie)</span>
          <p className="mt-3 text-neutral-500">
            Lundi – Vendredi / 9h30 - 13h00, 14h00 - 17h30
          </p>
        </ContactSection>
      </div>
    </CustomerServiceLayout>
  );
}
