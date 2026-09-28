"use client";

import CustomerServiceLayout from "@/components/CustomerServiceLayout";
import SizeGuideTable from "@/components/SizeGuideTable";
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import { MEASURE_STEPS } from "@/lib/sizeGuideData";

export default function SizeGuideContent() {
  const { t } = useTranslations();

  return (
    <CustomerServiceLayout title={t("sizeGuide.title")} subtitle={t("sizeGuide.subtitle")}>
      <SizeGuideTable />

      <section className="mt-12">
        <h2 className="mb-2 text-lg font-bold uppercase tracking-wide">
          {t("sizeGuide.howToMeasure")}
        </h2>
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-600">
          {t("sizeGuide.measureIntro")}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {MEASURE_STEPS.map((step) => (
            <article
              key={step.key}
              className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-black/20 hover:shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                {step.key}
              </span>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-10 rounded-xl bg-neutral-50 px-5 py-4 text-center text-sm text-neutral-600">
        {t("sizeGuide.betweenSizesBefore")}{" "}
        <a
          href="/contact"
          className="font-medium text-black underline underline-offset-2 hover:text-zinc-700"
        >
          {t("sizeGuide.contactUs")}
        </a>{" "}
        {t("sizeGuide.betweenSizesAfter")}
      </p>
    </CustomerServiceLayout>
  );
}
