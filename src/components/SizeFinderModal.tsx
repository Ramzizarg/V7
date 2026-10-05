"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Minus, Plus, Ruler, Sparkles, X } from "lucide-react";
import SizeGuideTable from "@/components/SizeGuideTable";
import { useTranslations } from "@/i18n/SiteLocaleProvider";
import { shouldBypassImageOptimization } from "@/lib/imageOptimize";
import { normalizeSizeKey } from "@/lib/productSizeStock";
import { SIZE_GUIDE_ROWS, type SizeGuideCategory } from "@/lib/sizeGuideData";
import {
  bmiOf,
  CHEST_LIMITS,
  DEFAULT_BODY,
  HEIGHT_LIMITS,
  loadSizeProfile,
  recommendSize,
  saveSizeProfile,
  WEIGHT_LIMITS,
  type BodyShape,
  type FitPreference,
  type SizeProfile,
} from "@/lib/sizeRecommendation";

type SizeOption = { label: string; available: boolean };

type Props = {
  onClose: () => void;
  sizeOptions: SizeOption[];
  onSelectSize?: (label: string) => void;
  sizeGuideImage?: string | null;
  defaultGender?: SizeGuideCategory;
};

type Step = "gender" | "body" | "result";

function clampInt(value: number, min: number, max: number) {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint: string }[];
  label: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
              className={`rounded-xl border px-2 py-2.5 text-center transition ${
                selected
                  ? "border-black bg-black text-white"
                  : "border-zinc-200 bg-white text-black hover:border-zinc-400"
              }`}
            >
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className={`mt-0.5 block text-[10px] leading-tight ${selected ? "text-white/70" : "text-zinc-500"}`}>
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MeasureField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  const commit = (raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (!raw.trim() || !Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const next = clampInt(n, min, max);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(clampInt(value - 1, min, max))}
            disabled={value <= min}
            aria-label={`${label} -1`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-black hover:text-black disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <label className="flex items-baseline gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
              }}
              aria-label={label}
              className="w-14 border-b border-transparent bg-transparent text-center text-2xl font-bold tabular-nums text-black outline-none focus:border-black"
            />
            <span className="text-sm font-medium text-zinc-500">{unit}</span>
          </label>
          <button
            type="button"
            onClick={() => onChange(clampInt(value + 1, min, max))}
            disabled={value >= max}
            aria-label={`${label} +1`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-black hover:text-black disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-3 w-full accent-black"
      />
      <div className="flex justify-between text-[10px] font-medium text-zinc-400">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}

export default function SizeFinderModal({ onClose, sizeOptions, onSelectSize, sizeGuideImage, defaultGender }: Props) {
  const { t } = useTranslations();
  const [saved] = useState<SizeProfile | null>(() => loadSizeProfile());
  const [tab, setTab] = useState<"finder" | "chart">("finder");
  const [step, setStep] = useState<Step>(saved ? "result" : "gender");
  const [gender, setGender] = useState<SizeGuideCategory>(saved?.gender ?? defaultGender ?? "homme");
  const [heightCm, setHeightCm] = useState(saved?.heightCm ?? DEFAULT_BODY[gender].heightCm);
  const [weightKg, setWeightKg] = useState(saved?.weightKg ?? DEFAULT_BODY[gender].weightKg);
  const [bodyTouched, setBodyTouched] = useState(Boolean(saved));
  const [shape, setShape] = useState<BodyShape>(saved?.shape ?? "average");
  const [fit, setFit] = useState<FitPreference>(saved?.fit ?? "regular");
  const [chestOpen, setChestOpen] = useState(Boolean(saved?.chestCm));
  const [chestCm, setChestCm] = useState<number>(saved?.chestCm ?? (gender === "femme" ? 90 : 100));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const profile: SizeProfile = useMemo(
    () => ({ gender, heightCm, weightKg, shape, fit, chestCm: chestOpen ? chestCm : null }),
    [gender, heightCm, weightKg, shape, fit, chestOpen, chestCm]
  );

  const result = useMemo(() => recommendSize(profile), [profile]);
  const bmi = bmiOf(heightCm, weightKg);
  const unusualBody = bmi < 15 || bmi > 45;

  const findOption = (label: string | null) =>
    label ? sizeOptions.find((o) => normalizeSizeKey(o.label) === normalizeSizeKey(label)) ?? null : null;
  const recommendedOption = findOption(result.size);
  const alternativeOption = findOption(result.alternative);
  const productHasSize = recommendedOption != null;
  const recommendedAvailable = Boolean(recommendedOption?.available);
  const fallbackOption = !recommendedAvailable && alternativeOption?.available ? alternativeOption : null;

  const chooseGender = (g: SizeGuideCategory) => {
    if (!bodyTouched || g !== gender) {
      setHeightCm(DEFAULT_BODY[g].heightCm);
      setWeightKg(DEFAULT_BODY[g].weightKg);
      setChestCm(g === "femme" ? 90 : 100);
    }
    setGender(g);
    setStep("body");
  };

  const showResult = () => {
    saveSizeProfile(profile);
    setStep("result");
  };

  const pick = (label: string) => {
    onSelectSize?.(label);
    onClose();
  };

  const stepNumber = step === "gender" ? 1 : step === "body" ? 2 : 3;
  const sizeRow = SIZE_GUIDE_ROWS[gender].map((r) => r.size);

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-end justify-center bg-black/60 transition-opacity duration-200 sm:items-center sm:p-6 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("sizeFinder.title")}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-zinc-50 shadow-2xl transition-transform duration-300 ease-out sm:rounded-3xl ${
          visible ? "translate-y-0" : "translate-y-8"
        }`}
      >
        <div className="border-b border-black/5 bg-white px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              <p className="text-sm font-bold uppercase tracking-wider">{t("sizeFinder.title")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1" role="tablist">
            {(["finder", "chart"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  tab === id ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"
                }`}
              >
                {id === "finder" ? t("sizeFinder.tabFinder") : t("sizeFinder.tabChart")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === "chart" ? (
            sizeGuideImage ? (
              <Image
                src={sizeGuideImage}
                alt={t("product.sizeGuide")}
                width={1200}
                height={1600}
                className="h-auto w-full rounded-xl object-contain"
                unoptimized={shouldBypassImageOptimization(sizeGuideImage)}
              />
            ) : (
              <SizeGuideTable compact />
            )
          ) : (
            <>
              <div className="mb-5 flex items-center gap-3">
                {step !== "gender" ? (
                  <button
                    type="button"
                    onClick={() => setStep(step === "result" ? "body" : "gender")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:border-black hover:text-black"
                    aria-label={t("sizeFinder.back")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="flex flex-1 gap-1.5" aria-hidden>
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${n <= stepNumber ? "bg-black" : "bg-zinc-200"}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-zinc-500">
                  {t("sizeFinder.stepOf", { n: stepNumber, total: 3 })}
                </span>
              </div>

              {step === "gender" ? (
                <div>
                  <h3 className="text-lg font-bold text-black">{t("sizeFinder.genderTitle")}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{t("sizeFinder.genderSubtitle")}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {(["homme", "femme"] as const).map((g) => {
                      const selected = bodyTouched && gender === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => chooseGender(g)}
                          className={`group flex flex-col items-center gap-3 rounded-2xl border-2 bg-white px-4 py-6 transition hover:border-black ${
                            selected ? "border-black" : "border-zinc-200"
                          }`}
                        >
                          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl transition group-hover:bg-black group-hover:text-white">
                            {g === "homme" ? "♂" : "♀"}
                          </span>
                          <span className="text-sm font-bold uppercase tracking-wider">
                            {g === "homme" ? t("sizeGuide.homme") : t("sizeGuide.femme")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === "body" ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-black">{t("sizeFinder.bodyTitle")}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{t("sizeFinder.bodySubtitle")}</p>
                  </div>
                  <MeasureField
                    label={t("sizeFinder.height")}
                    unit="cm"
                    value={heightCm}
                    min={HEIGHT_LIMITS.min}
                    max={HEIGHT_LIMITS.max}
                    onChange={(v) => {
                      setHeightCm(v);
                      setBodyTouched(true);
                    }}
                  />
                  <MeasureField
                    label={t("sizeFinder.weight")}
                    unit="kg"
                    value={weightKg}
                    min={WEIGHT_LIMITS.min}
                    max={WEIGHT_LIMITS.max}
                    onChange={(v) => {
                      setWeightKg(v);
                      setBodyTouched(true);
                    }}
                  />
                  {unusualBody ? (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      {t("sizeFinder.checkValues")}
                    </p>
                  ) : null}
                  <ChoiceChips
                    label={t("sizeFinder.shapeLabel")}
                    value={shape}
                    onChange={setShape}
                    options={[
                      { value: "slim", label: t("sizeFinder.shapeSlim"), hint: t("sizeFinder.shapeSlimHint") },
                      { value: "average", label: t("sizeFinder.shapeAverage"), hint: t("sizeFinder.shapeAverageHint") },
                      {
                        value: "broad",
                        label: t("sizeFinder.shapeBroad"),
                        hint: gender === "femme" ? t("sizeFinder.shapeBroadHintFemme") : t("sizeFinder.shapeBroadHintHomme"),
                      },
                    ]}
                  />
                  <ChoiceChips
                    label={t("sizeFinder.fitLabel")}
                    value={fit}
                    onChange={setFit}
                    options={[
                      { value: "slim", label: t("sizeFinder.fitSlim"), hint: t("sizeFinder.fitSlimHint") },
                      { value: "regular", label: t("sizeFinder.fitRegular"), hint: t("sizeFinder.fitRegularHint") },
                      { value: "loose", label: t("sizeFinder.fitLoose"), hint: t("sizeFinder.fitLooseHint") },
                    ]}
                  />
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-white">
                    <button
                      type="button"
                      onClick={() => setChestOpen((v) => !v)}
                      aria-expanded={chestOpen}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-black">{t("sizeFinder.chestToggle")}</span>
                        <span className="block text-xs text-zinc-500">{t("sizeFinder.chestToggleHint")}</span>
                      </span>
                      <span
                        className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                          chestOpen ? "bg-black" : "bg-zinc-300"
                        }`}
                        aria-hidden
                      >
                        <span
                          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            chestOpen ? "translate-x-4" : ""
                          }`}
                        />
                      </span>
                    </button>
                    {chestOpen ? (
                      <div className="px-3 pb-3">
                        <MeasureField
                          label={t("sizeFinder.chest")}
                          unit="cm"
                          value={chestCm}
                          min={CHEST_LIMITS.min}
                          max={CHEST_LIMITS.max}
                          onChange={setChestCm}
                        />
                        <p className="mt-2 text-[11px] leading-snug text-zinc-500">{t("sizeFinder.chestHowTo")}</p>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={showResult}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t("sizeFinder.seeMySize")}
                  </button>
                </div>
              ) : null}

              {step === "result" ? (
                <div>
                  <div className="rounded-3xl bg-black px-5 py-6 text-center text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                      {t("sizeFinder.yourSize")}
                    </p>
                    <p className="mt-2 text-6xl font-black tracking-tight">{result.size}</p>
                    <p className="mt-2 text-sm text-white/80">
                      {result.confidence === "high"
                        ? t("sizeFinder.confidenceHigh")
                        : result.confidence === "medium"
                          ? t("sizeFinder.confidenceMedium")
                          : t("sizeFinder.confidenceBetween")}
                    </p>
                    <div className="mt-5 flex justify-center gap-1.5">
                      {sizeRow.map((s) => {
                        const isMain = s === result.size;
                        const isAlt = s === result.alternative;
                        return (
                          <span
                            key={s}
                            className={`flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg px-1.5 text-xs font-bold transition ${
                              isMain
                                ? "scale-110 bg-white text-black"
                                : isAlt
                                  ? "border border-white/60 text-white"
                                  : "text-white/35"
                            }`}
                          >
                            {s}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {result.alternative ? (
                    <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700 ring-1 ring-black/5">
                      {result.alternativeDirection === "larger"
                        ? t("sizeFinder.altLarger", { size: result.alternative })
                        : t("sizeFinder.altSmaller", { size: result.alternative })}
                    </p>
                  ) : null}

                  {result.outOfRange ? (
                    <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {result.outOfRange === "below" ? t("sizeFinder.outOfRangeBelow") : t("sizeFinder.outOfRangeAbove")}
                    </p>
                  ) : null}

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {(
                      [
                        ["chest", result.estimates.chest],
                        ["waist", result.estimates.waist],
                        ["hips", result.estimates.hips],
                      ] as const
                    ).map(([key, cm]) => (
                      <div key={key} className="rounded-2xl bg-white px-2 py-3 ring-1 ring-black/5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {t(`sizeGuide.${key}`)}
                        </p>
                        <p className="mt-1 text-base font-bold tabular-nums text-black">≈ {cm} cm</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-zinc-500">
                    {t("sizeFinder.profileSummary", {
                      gender: gender === "homme" ? t("sizeGuide.homme") : t("sizeGuide.femme"),
                      height: heightCm,
                      weight: weightKg,
                    })}
                  </p>

                  <div className="mt-5 space-y-2">
                    {onSelectSize && productHasSize && recommendedAvailable ? (
                      <button
                        type="button"
                        onClick={() => pick(recommendedOption!.label)}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800"
                      >
                        <Check className="h-4 w-4" />
                        {t("sizeFinder.chooseSize", { size: recommendedOption!.label })}
                      </button>
                    ) : null}
                    {onSelectSize && productHasSize && !recommendedAvailable ? (
                      <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
                        {t("sizeFinder.sizeSoldOut", { size: result.size })}
                      </p>
                    ) : null}
                    {onSelectSize && fallbackOption ? (
                      <button
                        type="button"
                        onClick={() => pick(fallbackOption.label)}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-black bg-white px-5 py-3 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-zinc-100"
                      >
                        {t("sizeFinder.chooseSize", { size: fallbackOption.label })}
                      </button>
                    ) : null}
                    {onSelectSize && result.alternative && recommendedAvailable && alternativeOption?.available ? (
                      <button
                        type="button"
                        onClick={() => pick(alternativeOption.label)}
                        className="w-full py-1 text-xs font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                      >
                        {t("sizeFinder.chooseInstead", { size: alternativeOption.label })}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setStep("body")}
                      className="w-full py-1 text-xs font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-black"
                    >
                      {t("sizeFinder.editInfo")}
                    </button>
                  </div>

                  <p className="mt-4 text-center text-[11px] leading-snug text-zinc-400">{t("sizeFinder.disclaimer")}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
