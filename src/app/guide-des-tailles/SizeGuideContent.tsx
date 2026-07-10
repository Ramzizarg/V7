"use client";

import { useState } from "react";
import CustomerServiceLayout from "@/components/CustomerServiceLayout";
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import {
  formatMeasurement,
  MEASURE_STEPS,
  SIZE_GUIDE_ROWS,
  type SizeGuideCategory,
  type SizeGuideUnit,
} from "@/lib/sizeGuideData";

function UnitToggle({
  unit,
  onChange,
  inchesLabel,
  measureUnitAria,
}: {
  unit: SizeGuideUnit;
  onChange: (unit: SizeGuideUnit) => void;
  inchesLabel: string;
  measureUnitAria: string;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1"
      role="group"
      aria-label={measureUnitAria}
    >
      {(["cm", "in"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={unit === value}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
            unit === value
              ? "bg-black text-white shadow-sm"
              : "text-neutral-600 hover:text-black"
          }`}
        >
          {value === "cm" ? "CM" : inchesLabel}
        </button>
      ))}
    </div>
  );
}

export default function SizeGuideContent() {
  const { t } = useTranslations();
  const [category, setCategory] = useState<SizeGuideCategory>("homme");
  const [unit, setUnit] = useState<SizeGuideUnit>("cm");

  const categories: { id: SizeGuideCategory; label: string; title: string; clothing: string }[] = [
    {
      id: "homme",
      label: t("sizeGuide.homme"),
      title: t("sizeGuide.hommeTitle"),
      clothing: t("sizeGuide.hommeClothing"),
    },
    {
      id: "femme",
      label: t("sizeGuide.femme"),
      title: t("sizeGuide.femmeTitle"),
      clothing: t("sizeGuide.femmeClothing"),
    },
  ];

  const active = categories.find((c) => c.id === category)!;
  const rows = SIZE_GUIDE_ROWS[category];
  const unitLabel = unit === "cm" ? "cm" : "in";

  return (
    <CustomerServiceLayout title={t("sizeGuide.title")} subtitle={t("sizeGuide.subtitle")}>
      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map((item) => {
          const selected = category === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              aria-pressed={selected}
              className={`min-w-[7rem] flex-1 rounded-lg border px-5 py-3 text-sm font-bold uppercase tracking-wide transition sm:flex-none ${
                selected
                  ? "border-black bg-black text-white"
                  : "border-neutral-300 bg-white text-black hover:border-black/40"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wide">{active.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">{active.clothing}</p>
            </div>
            <UnitToggle
              unit={unit}
              onChange={setUnit}
              inchesLabel={t("sizeGuide.inches")}
              measureUnitAria={t("sizeGuide.measureUnitAria")}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-black text-left text-xs font-semibold uppercase tracking-wider text-white">
                <th className="px-5 py-4 sm:px-6">{t("sizeGuide.size")}</th>
                <th className="px-5 py-4 sm:px-6">
                  {t("sizeGuide.chest")} ({unitLabel})
                </th>
                <th className="px-5 py-4 sm:px-6">
                  {t("sizeGuide.waist")} ({unitLabel})
                </th>
                <th className="px-5 py-4 sm:px-6">
                  {t("sizeGuide.hips")} ({unitLabel})
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.size}
                  className={`border-t border-neutral-100 transition hover:bg-black/[0.03] ${
                    index % 2 === 0 ? "bg-white" : "bg-neutral-50/80"
                  }`}
                >
                  <td className="px-5 py-4 font-bold text-black sm:px-6">{row.size}</td>
                  <td className="px-5 py-4 text-neutral-700 sm:px-6">
                    {formatMeasurement(row.chest, unit)}
                  </td>
                  <td className="px-5 py-4 text-neutral-700 sm:px-6">
                    {formatMeasurement(row.waist, unit)}
                  </td>
                  <td className="px-5 py-4 text-neutral-700 sm:px-6">
                    {formatMeasurement(row.hips, unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
