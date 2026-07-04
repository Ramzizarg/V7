"use client";

import CustomerServiceLayout from "@/components/CustomerServiceLayout";

export default function ShippingTermsContent() {
  return (
    <CustomerServiceLayout
      title="Livraison & Retours"
      subtitle="Dernière mise à jour : Mai 2026"
    >
        {/* Zones & Délais */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Livraison
          </h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Zone</th>
                  <th className="px-4 py-3">Délai estimé</th>
                  <th className="px-4 py-3">Frais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="px-4 py-3 font-medium">Toute la Tunisie</td>
                  <td className="px-4 py-3">48h – 72h</td>
                  <td className="px-4 py-3">8 DT</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Nous livrons partout en Tunisie. Les délais sont indicatifs et courent à partir de la confirmation d'expédition. Ils peuvent varier en période de forte activité (soldes, fêtes).
          </p>
        </section>

        {/* Suivi de commande */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Suivi de commande
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Un e-mail de confirmation contenant votre numéro de suivi vous est envoyé dès
            l'expédition de votre colis. Vous pouvez suivre l'acheminement directement
            depuis le site du transporteur ou en répondant à l'e-mail de confirmation pour
            toute question.
          </p>
        </section>

        {/* Retours & Échanges */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Retours & Échanges
          </h2>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-700">
            <li>
              Vous disposez de <strong>14 jours</strong> après réception pour retourner un article.
            </li>
            <li>
              Les articles doivent être dans leur état d'origine, non portés, non lavés et avec
              les étiquettes intactes.
            </li>
            <li>
              Les frais de retour sont à la charge du client, sauf en cas d'erreur de notre part
              ou de produit défectueux.
            </li>
            <li>
              Pour initier un retour, contactez-nous par e-mail à{" "}
              <a
                href="mailto:contact@vero-7.com"
                className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
              >
                contact@vero-7.com
              </a>{" "}
              en précisant votre numéro de commande et le motif du retour.
            </li>
          </ul>
        </section>

        {/* Remboursements */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Remboursements
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Une fois le retour reçu et inspecté, le remboursement est effectué sous
            <strong> 7 jours ouvrés</strong> sur le moyen de paiement initial. Vous recevrez
            un e-mail de confirmation dès le traitement.
          </p>
        </section>

        {/* Colis endommagé / perdu */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Colis endommagé ou perdu
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Si votre colis arrive endommagé, prenez des photos et contactez-nous dans les
            48 heures suivant la réception. En cas de colis perdu (délai dépassé de plus de
            5 jours ouvrés sans mise à jour du suivi), nous ouvrons une enquête auprès du
            transporteur et procédons à un renvoi ou un remboursement selon votre
            préférence.
          </p>
        </section>

        {/* Conditions générales */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Conditions générales
          </h2>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-700">
            <li>
              Toute commande passée sur vero7.com implique l'acceptation des présentes
              conditions.
            </li>
            <li>
              Les prix affichés sont en Dinars Tunisiens (DT) et incluent la TVA applicable.
            </li>
            <li>
              Vero7 se réserve le droit de modifier les frais de livraison et délais sans
              préavis.
            </li>
            <li>
              En cas de rupture de stock après commande, vous serez informé dans les
              meilleurs délais et remboursé intégralement.
            </li>
          </ul>
        </section>

        {/* Contact */}
        <section>
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            Besoin d'aide ?
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            Notre équipe est disponible du lundi au vendredi, de 9h à 18h.
            Écrivez-nous à{" "}
            <a
              href="mailto:contact@vero-7.com"
              className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
            >
              contact@vero-7.com
            </a>{" "}
            — nous répondons sous 24 à 48h.
          </p>
        </section>
    </CustomerServiceLayout>
  );
}
