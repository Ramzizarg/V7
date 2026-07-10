"use client";

import CustomerServiceLayout from "@/components/CustomerServiceLayout";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

const CONTACT_EMAIL = "contact@vero-7.com";

export default function ShippingTermsContent() {
  const { t } = useTranslations();

  return (
    <CustomerServiceLayout title={t("shipping.title")} subtitle={t("shipping.subtitle")}>
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
          {t("shipping.deliveryTitle")}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase text-neutral-600">
              <tr>
                <th className="px-4 py-3">{t("shipping.zoneCol")}</th>
                <th className="px-4 py-3">{t("shipping.delayCol")}</th>
                <th className="px-4 py-3">{t("shipping.feeCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr>
                <td className="px-4 py-3 font-medium">{t("shipping.zoneAllTunisia")}</td>
                <td className="px-4 py-3">{t("shipping.delayValue")}</td>
                <td className="px-4 py-3">{t("shipping.feeValue")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-500">{t("shipping.deliveryNote")}</p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
          {t("shipping.trackingTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t("shipping.trackingDesc")}</p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
          {t("shipping.returnsTitle")}
        </h2>
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-700">
          <li>
            {t("shipping.returns1Before")} <strong>{t("shipping.returns1Highlight")}</strong>{" "}
            {t("shipping.returns1After")}
          </li>
          <li>{t("shipping.returns2")}</li>
          <li>{t("shipping.returns3")}</li>
          <li>
            {t("shipping.returns4Before")}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            {t("shipping.returns4After")}
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
          {t("shipping.refundsTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          {t("shipping.refundsDescBefore")}
          <strong> {t("shipping.refundsDescHighlight")}</strong> {t("shipping.refundsDescAfter")}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
          {t("shipping.damagedTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t("shipping.damagedDesc")}</p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
          {t("shipping.termsTitle")}
        </h2>
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-700">
          <li>{t("shipping.terms1")}</li>
          <li>{t("shipping.terms2")}</li>
          <li>{t("shipping.terms3")}</li>
          <li>{t("shipping.terms4")}</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
          {t("shipping.helpTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          {t("shipping.helpDescBefore")}{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          {t("shipping.helpDescAfter")}
        </p>
      </section>
    </CustomerServiceLayout>
  );
}
