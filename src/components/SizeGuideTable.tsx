"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import {
  formatMeasurement,
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

export default function SizeGuideTable({ compact = false }: { compact?: boolean }) {
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
  const cell = compact ? "px-3 py-3 sm:px-4" : "px-5 py-4 sm:px-6";

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${compact ? "mb-4" : "mb-8"}`}>
        {categories.map((item) => {
          const selected = category === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              aria-pressed={selected}
              className={`min-w-[7rem] flex-1 rounded-lg border text-sm font-bold uppercase tracking-wide transition sm:flex-none ${
                compact ? "px-4 py-2.5" : "px-5 py-3"
              } ${
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
        <div
          className={`border-b border-neutral-200 bg-neutral-50 ${
            compact ? "px-4 py-4" : "px-6 py-5 sm:px-8"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className={`font-bold uppercase tracking-wide ${compact ? "text-base" : "text-lg"}`}>
                {active.title}
              </h2>
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
          <table className={`w-full text-sm ${compact ? "min-w-[360px]" : "min-w-[520px]"}`}>
            <thead>
              <tr className="bg-black text-left text-xs font-semibold uppercase tracking-wider text-white">
                <th className={cell}>{t("sizeGuide.size")}</th>
                <th className={cell}>
                  {t("sizeGuide.chest")} ({unitLabel})
                </th>
                <th className={cell}>
                  {t("sizeGuide.waist")} ({unitLabel})
                </th>
                <th className={cell}>
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
                  <td className={`${cell} font-bold text-black`}>{row.size}</td>
                  <td className={`${cell} text-neutral-700`}>{formatMeasurement(row.chest, unit)}</td>
                  <td className={`${cell} text-neutral-700`}>{formatMeasurement(row.waist, unit)}</td>
                  <td className={`${cell} text-neutral-700`}>{formatMeasurement(row.hips, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
