"use client";

import { useState } from "react";
import CustomerServiceLayout from "@/components/CustomerServiceLayout";
import {
  formatMeasurement,
  MEASURE_STEPS,
  SIZE_GUIDE_ROWS,
  type SizeGuideCategory,
  type SizeGuideUnit,
} from "@/lib/sizeGuideData";

const CATEGORIES: { id: SizeGuideCategory; label: string; title: string }[] = [
  { id: "homme", label: "Homme", title: "Guide des tailles homme" },
  { id: "femme", label: "Femme", title: "Guide des tailles femme" },
];

function UnitToggle({
  unit,
  onChange,
}: {
  unit: SizeGuideUnit;
  onChange: (unit: SizeGuideUnit) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1"
      role="group"
      aria-label="Unité de mesure"
    >
      {(["cm", "in"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={unit === value}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
            unit === value
              ? "bg-[#0f1f63] text-white shadow-sm"
              : "text-neutral-600 hover:text-black"
          }`}
        >
          {value === "cm" ? "CM" : "Pouces"}
        </button>
      ))}
    </div>
  );
}

export default function SizeGuideContent() {
  const [category, setCategory] = useState<SizeGuideCategory>("homme");
  const [unit, setUnit] = useState<SizeGuideUnit>("cm");

  const active = CATEGORIES.find((c) => c.id === category)!;
  const rows = SIZE_GUIDE_ROWS[category];
  const unitLabel = unit === "cm" ? "cm" : "in";

  return (
    <CustomerServiceLayout
      title="Guide des tailles"
      subtitle={
        <>
          Nos tailles suivent les standards européens. Les mesures indiquées correspondent
          à votre morphologie, pas au vêtement — pour un résultat plus précis.
        </>
      }
    >
        <div className="mb-8 flex flex-wrap gap-2">
          {CATEGORIES.map((item) => {
            const selected = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={selected}
                className={`min-w-[7rem] flex-1 rounded-lg border px-5 py-3 text-sm font-bold uppercase tracking-wide transition sm:flex-none ${
                  selected
                    ? "border-[#0f1f63] bg-[#0f1f63] text-white"
                    : "border-neutral-300 bg-white text-black hover:border-[#0f1f63]/40"
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
                <p className="mt-1 text-sm text-neutral-500">
                  {category === "homme" ? "Vêtements homme" : "Vêtements femme"}
                </p>
              </div>
              <UnitToggle unit={unit} onChange={setUnit} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-[#0f1f63] text-left text-xs font-semibold uppercase tracking-wider text-white">
                  <th className="px-5 py-4 sm:px-6">Taille</th>
                  <th className="px-5 py-4 sm:px-6">Poitrine ({unitLabel})</th>
                  <th className="px-5 py-4 sm:px-6">Taille ({unitLabel})</th>
                  <th className="px-5 py-4 sm:px-6">Hanches ({unitLabel})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.size}
                    className={`border-t border-neutral-100 transition hover:bg-[#0f1f63]/[0.03] ${
                      index % 2 === 0 ? "bg-white" : "bg-neutral-50/80"
                    }`}
                  >
                    <td className="px-5 py-4 font-bold text-[#0f1f63] sm:px-6">{row.size}</td>
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
          <h2 className="mb-2 text-lg font-bold uppercase tracking-wide">Comment mesurer</h2>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Suivez les étapes ci-dessous et gardez le mètre ruban bien horizontal pour un
            résultat fiable.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {MEASURE_STEPS.map((step) => (
              <article
                key={step.key}
                className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-[#0f1f63]/20 hover:shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f1f63] text-sm font-bold text-white">
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
          Entre deux tailles ? Choisissez la plus grande pour un confort optimal, ou{" "}
          <a
            href="/contact"
            className="font-medium text-[#0f1f63] underline underline-offset-2 hover:text-black"
          >
            contactez-nous
          </a>{" "}
          pour un conseil personnalisé.
        </p>
    </CustomerServiceLayout>
  );
}
