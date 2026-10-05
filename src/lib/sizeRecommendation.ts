import { SIZE_GUIDE_ROWS, type MeasurementRange, type SizeGuideCategory } from "@/lib/sizeGuideData";

export type FitPreference = "slim" | "regular" | "loose";
export type BodyShape = "slim" | "average" | "broad";

export type SizeProfile = {
  gender: SizeGuideCategory;
  heightCm: number;
  weightKg: number;
  shape: BodyShape;
  fit: FitPreference;
  /** Measured chest circumference; when set it outweighs the height/weight estimate. */
  chestCm?: number | null;
};

export type SizeRecommendation = {
  size: string;
  alternative: string | null;
  alternativeDirection: "smaller" | "larger" | null;
  confidence: "high" | "medium" | "between";
  outOfRange: "below" | "above" | null;
  /** Estimated body measurements (cm) used for the recommendation. */
  estimates: { chest: number; waist: number; hips: number };
};

export const HEIGHT_LIMITS = { min: 140, max: 210 } as const;
export const WEIGHT_LIMITS = { min: 35, max: 180 } as const;
export const CHEST_LIMITS = { min: 70, max: 150 } as const;

export const DEFAULT_BODY: Record<SizeGuideCategory, { heightCm: number; weightKg: number }> = {
  homme: { heightCm: 175, weightKg: 72 },
  femme: { heightCm: 163, weightKg: 58 },
};

type Part = "chest" | "waist" | "hips";

type BodyModel = {
  /** Weight / height (kg/cm) of a body sitting at the centre of size M in the chart. */
  refRatio: number;
  /** How fast each circumference grows with weight/height, and its weight in the final pick. */
  parts: Record<Part, { exponent: number; weight: number }>;
  /** Height usually wearing size S, and the extra height per size up (garment length). */
  baseHeight: number;
  heightPerSize: number;
};

const REF_SIZE_INDEX = 1;

const MODELS: Record<SizeGuideCategory, BodyModel> = {
  homme: {
    refRatio: 70 / 175,
    parts: {
      chest: { exponent: 0.55, weight: 0.7 },
      waist: { exponent: 0.8, weight: 0.3 },
      hips: { exponent: 0.55, weight: 0 },
    },
    baseHeight: 170,
    heightPerSize: 5,
  },
  femme: {
    refRatio: 59 / 164,
    parts: {
      chest: { exponent: 0.6, weight: 0.45 },
      waist: { exponent: 0.8, weight: 0.25 },
      hips: { exponent: 0.6, weight: 0.3 },
    },
    baseHeight: 158,
    heightPerSize: 4,
  },
};

const SHAPE_SHIFT: Record<BodyShape, number> = { slim: -0.3, average: 0, broad: 0.35 };
const FIT_SHIFT: Record<FitPreference, number> = { slim: -0.35, regular: 0, loose: 0.6 };

function center(value: MeasurementRange): number {
  return typeof value === "number" ? value : (value[0] + value[1]) / 2;
}

/** Continuous size position (0 = first row) by linear interpolation between row centres. */
function sizeIndexFor(value: number, centers: number[]): number {
  const n = centers.length;
  let idx: number;
  if (value <= centers[0]) {
    idx = (value - centers[0]) / (centers[1] - centers[0]);
  } else if (value >= centers[n - 1]) {
    idx = n - 1 + (value - centers[n - 1]) / (centers[n - 1] - centers[n - 2]);
  } else {
    let i = 0;
    while (value > centers[i + 1]) i += 1;
    idx = i + (value - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return Math.min(n, Math.max(-1, idx));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function recommendSize(profile: SizeProfile): SizeRecommendation {
  const rows = SIZE_GUIDE_ROWS[profile.gender];
  const model = MODELS[profile.gender];
  const heightCm = clamp(profile.heightCm, HEIGHT_LIMITS.min, HEIGHT_LIMITS.max);
  const weightKg = clamp(profile.weightKg, WEIGHT_LIMITS.min, WEIGHT_LIMITS.max);
  const ratio = weightKg / heightCm / model.refRatio;

  const parts: Part[] = ["chest", "waist", "hips"];
  const estimates = {} as Record<Part, number>;
  for (const part of parts) {
    estimates[part] = center(rows[REF_SIZE_INDEX][part]) * Math.pow(ratio, model.parts[part].exponent);
  }

  const measuredChest =
    profile.chestCm != null && Number.isFinite(profile.chestCm)
      ? clamp(profile.chestCm, CHEST_LIMITS.min, CHEST_LIMITS.max)
      : null;
  if (measuredChest != null) estimates.chest = measuredChest;

  const weights: Record<Part, number> = {
    chest: model.parts.chest.weight,
    waist: model.parts.waist.weight,
    hips: model.parts.hips.weight,
  };
  if (measuredChest != null) {
    const others = weights.waist + weights.hips;
    weights.chest = 0.75;
    weights.waist = others > 0 ? (weights.waist / others) * 0.25 : 0;
    weights.hips = others > 0 ? (weights.hips / others) * 0.25 : 0;
  }

  let bodyIndex = 0;
  let totalWeight = 0;
  for (const part of parts) {
    if (weights[part] <= 0) continue;
    const centers = rows.map((r) => center(r[part]));
    bodyIndex += sizeIndexFor(estimates[part], centers) * weights[part];
    totalWeight += weights[part];
  }
  bodyIndex /= totalWeight;

  const heightIndex = (heightCm - model.baseHeight) / model.heightPerSize;
  const lengthBump = Math.min(1, Math.max(0, heightIndex - bodyIndex - 1.5) * 0.4);

  const raw = bodyIndex + lengthBump + SHAPE_SHIFT[profile.shape] + FIT_SHIFT[profile.fit];
  const last = rows.length - 1;
  const index = clamp(raw, 0, last);
  const primary = Math.round(index);
  const delta = index - primary;
  const distance = Math.abs(delta);

  let alternativeIndex: number | null = null;
  if (distance >= 0.33) {
    const next = primary + Math.sign(delta);
    if (next >= 0 && next <= last) alternativeIndex = next;
  }

  return {
    size: rows[primary].size,
    alternative: alternativeIndex != null ? rows[alternativeIndex].size : null,
    alternativeDirection:
      alternativeIndex == null ? null : alternativeIndex > primary ? "larger" : "smaller",
    confidence: alternativeIndex != null ? "between" : distance < 0.2 ? "high" : "medium",
    outOfRange: raw < -0.7 ? "below" : raw > last + 0.7 ? "above" : null,
    estimates: {
      chest: Math.round(estimates.chest),
      waist: Math.round(estimates.waist),
      hips: Math.round(estimates.hips),
    },
  };
}

export function bmiOf(heightCm: number, weightKg: number) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

const PROFILE_STORAGE_KEY = "vero7:size-profile:v1";

export function loadSizeProfile(): SizeProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SizeProfile>;
    if (p.gender !== "homme" && p.gender !== "femme") return null;
    if (!Number.isFinite(p.heightCm) || !Number.isFinite(p.weightKg)) return null;
    return {
      gender: p.gender,
      heightCm: clamp(Number(p.heightCm), HEIGHT_LIMITS.min, HEIGHT_LIMITS.max),
      weightKg: clamp(Number(p.weightKg), WEIGHT_LIMITS.min, WEIGHT_LIMITS.max),
      shape: p.shape === "slim" || p.shape === "broad" ? p.shape : "average",
      fit: p.fit === "slim" || p.fit === "loose" ? p.fit : "regular",
      chestCm: Number.isFinite(p.chestCm) ? Number(p.chestCm) : null,
    };
  } catch {
    return null;
  }
}

export function saveSizeProfile(profile: SizeProfile) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
}
