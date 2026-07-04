"use client";

import { useState } from "react";
import CustomerServiceLayout from "@/components/CustomerServiceLayout";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    question: "Quels sont les délais de livraison ?",
    answer:
      "Nous livrons partout en Tunisie sous 48h à 72h après confirmation de votre commande.",
  },
  {
    question: "Combien coûte la livraison ?",
    answer:
      "Les frais de livraison sont de 8 DT pour toute la Tunisie, quelle que soit votre adresse.",
  },
  {
    question: "Livrez-vous en dehors de la Tunisie ?",
    answer:
      "Pour le moment, nous livrons uniquement en Tunisie. Nous travaillons à étendre nos zones de livraison prochainement.",
  },
  {
    question: "Comment passer une commande ?",
    answer:
      "Ajoutez les articles souhaités à votre panier, puis suivez les étapes de validation. Vous recevrez un e-mail de confirmation une fois votre commande enregistrée.",
  },
  {
    question: "Quels moyens de paiement acceptez-vous ?",
    answer:
      "Nous acceptons le paiement à la livraison (cash on delivery). D'autres options de paiement seront bientôt disponibles.",
  },
  {
    question: "Puis-je modifier ou annuler ma commande ?",
    answer:
      "Vous pouvez modifier ou annuler votre commande tant qu'elle n'a pas encore été expédiée. Contactez-nous rapidement à contact@vero-7.com.",
  },
  {
    question: "Comment suivre ma commande ?",
    answer:
      "Un e-mail de confirmation avec les détails de suivi vous est envoyé dès l'expédition de votre colis. Vous pouvez aussi nous contacter pour connaître l'état de votre livraison.",
  },
  {
    question: "Que faire si je reçois un article endommagé ?",
    answer:
      "Prenez des photos de l'article et du colis, puis contactez-nous dans les 48h suivant la réception à contact@vero-7.com. Nous procéderons à un échange ou un remboursement.",
  },
  {
    question: "Puis-je retourner un article ?",
    answer:
      "Oui, vous disposez de 14 jours après réception pour retourner un article dans son état d'origine (non porté, non lavé, étiquettes intactes). Les frais de retour sont à votre charge.",
  },
  {
    question: "Sous quel délai suis-je remboursé ?",
    answer:
      "Le remboursement est effectué sous 7 jours ouvrés après réception et vérification de l'article retourné.",
  },
  {
    question: "Les tailles correspondent-elles aux standards ?",
    answer:
      "Nos tailles suivent les standards habituels. Consultez le guide des tailles disponible sur chaque fiche produit pour choisir la taille idéale.",
  },
  {
    question: "Comment vous contacter ?",
    answer:
      "Écrivez-nous à contact@vero-7.com — notre équipe répond du lundi au vendredi, de 9h à 18h, sous 24 à 48h.",
  },
];

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-sm font-semibold text-neutral-900">
          {item.question}
        </span>
        <span className="flex-shrink-0 text-lg text-neutral-400">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <p className="pb-5 pr-8 text-sm leading-relaxed text-neutral-600">
          {item.answer}
        </p>
      )}
    </div>
  );
}

export default function FaqContent() {
  return (
    <CustomerServiceLayout
      title="Questions fréquentes"
      subtitle="Retrouvez les réponses aux questions les plus posées par nos clients."
    >
      <div className="divide-y divide-neutral-200 border-t border-neutral-200">
        {FAQ_DATA.map((item, i) => (
          <FaqAccordionItem key={i} item={item} />
        ))}
      </div>

      <div className="mt-12 rounded-lg bg-neutral-50 p-6 text-center">
        <p className="text-sm text-neutral-700">
          Vous n&apos;avez pas trouvé votre réponse ?
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          Contactez-nous à{" "}
          <a
            href="mailto:contact@vero-7.com"
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            contact@vero-7.com
          </a>
        </p>
      </div>
    </CustomerServiceLayout>
  );
}
