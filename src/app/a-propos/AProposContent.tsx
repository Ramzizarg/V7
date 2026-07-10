"use client";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

const CONTACT_EMAIL = "contact@vero-7.com";

export default function AProposContent() {
  const { t } = useTranslations();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-[860px] px-6 py-16 sm:px-8 lg:px-12">
        <h1 className="mb-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">
          {t("about.title")}
        </h1>
        <p className="mb-10 text-sm text-neutral-500">{t("about.subtitle")}</p>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            {t("about.whoWeAreTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">{t("about.intro")}</p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            {t("about.missionTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">{t("about.mission")}</p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            {t("about.valuesTitle")}
          </h2>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-700">
            <li>
              <strong>{t("about.quality")}</strong> — {t("about.qualityDesc")}
            </li>
            <li>
              <strong>{t("about.accessibility")}</strong> — {t("about.accessibilityDesc")}
            </li>
            <li>
              <strong>{t("about.community")}</strong> — {t("about.communityDesc")}
            </li>
            <li>
              <strong>{t("about.authenticity")}</strong> — {t("about.authenticityDesc")}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">
            {t("about.joinUsTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            {t("about.joinUsDesc")}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
