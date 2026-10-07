export const TUNISIA_GOVERNORATES = [
  "Ariana", "Beja", "Ben Arous", "Bizerte", "Gabes", "Gafsa", "Jendouba",
  "Kairouan", "Kasserine", "Kebili", "Le Kef", "Mahdia", "Manouba", "Medenine",
  "Monastir", "Nabeul", "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tataouine",
  "Tozeur", "Tunis", "Zaghouan",
];

/** Display names; the stored value stays unaccented because it is sent as-is to Calirex. */
const GOVERNORATE_LABELS: Record<string, string> = {
  Beja: "Béja",
  Gabes: "Gabès",
  Kebili: "Kébili",
  Medenine: "Médenine",
};

export function governorateLabel(value: string): string {
  return GOVERNORATE_LABELS[value] ?? value;
}
