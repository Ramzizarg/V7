export type SizeGuideCategory = "homme" | "femme";
export type SizeGuideUnit = "cm" | "in";

export type MeasurementRange = [number, number] | number;

export type SizeGuideRow = {
  size: string;
  chest: MeasurementRange;
  waist: MeasurementRange;
  hips: MeasurementRange;
};

export const SIZE_GUIDE_ROWS: Record<SizeGuideCategory, SizeGuideRow[]> = {
  homme: [
    { size: "XS", chest: [87, 91], waist: [72, 76], hips: [87, 91] },
    { size: "S", chest: [92, 96], waist: [77, 81], hips: [92, 96] },
    { size: "M", chest: [97, 101], waist: [82, 86], hips: [97, 101] },
    { size: "L", chest: [102, 107], waist: 87, hips: [102, 107] },
    { size: "XL", chest: [108, 113], waist: 92, hips: [108, 113] },
    { size: "XXL", chest: [114, 119], waist: [93, 98], hips: [114, 119] },
    { size: "3XL", chest: [120, 125], waist: [99, 104], hips: [120, 125] },
  ],
  femme: [
    { size: "XS", chest: [78, 82], waist: [60, 64], hips: [84, 88] },
    { size: "S", chest: [83, 87], waist: [65, 69], hips: [89, 93] },
    { size: "M", chest: [88, 92], waist: [70, 74], hips: [94, 98] },
    { size: "L", chest: [93, 98], waist: [75, 80], hips: [99, 104] },
    { size: "XL", chest: [99, 109], waist: [81, 91], hips: [105, 115] },
    { size: "XXL", chest: [110, 120], waist: [92, 102], hips: [116, 126] },
    { size: "3XL", chest: [121, 131], waist: [103, 113], hips: [127, 137] },
  ],
};

export const MEASURE_STEPS = [
  {
    key: "A",
    title: "Épaules",
    text: "Étirez le mètre d'un bout de l'épaule à l'autre, bien à l'horizontale.",
  },
  {
    key: "B",
    title: "Poitrine",
    text: "Passez le mètre autour de la partie la plus large de votre poitrine.",
  },
  {
    key: "C",
    title: "Taille",
    text: "Mesurez à l'endroit où vous vous pliez naturellement sur le côté, généralement la partie la plus fine.",
  },
  {
    key: "D",
    title: "Hanches",
    text: "Faites le tour du mètre autour de la partie la plus large des hanches.",
  },
] as const;

function toDisplayValue(cm: number, unit: SizeGuideUnit): string {
  if (unit === "cm") return String(cm);
  return (cm / 2.54).toFixed(1);
}

export function formatMeasurement(value: MeasurementRange, unit: SizeGuideUnit): string {
  if (typeof value === "number") {
    return toDisplayValue(value, unit);
  }
  const [min, max] = value;
  if (min === max) return toDisplayValue(min, unit);
  return `${toDisplayValue(min, unit)} – ${toDisplayValue(max, unit)}`;
}
