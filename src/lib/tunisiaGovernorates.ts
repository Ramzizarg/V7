import calirexDelegations from "@/lib/calirexDelegations.json";

/**
 * Exact gouvernorat values from Calirex `modifier_colis.php`
 * (jetngovtoville.php). Mismatched names are stored as empty/null.
 */
export const TUNISIA_GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "La Manouba",
  "Le Kef",
  "Mahdia",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;

export type TunisiaGovernorate = (typeof TUNISIA_GOVERNORATES)[number];

const GOVERNORATE_LABELS: Record<string, string> = {
  Béja: "Béja",
  Gabès: "Gabès",
  Kébili: "Kébili",
  "La Manouba": "Manouba",
  "Le Kef": "Le Kef",
  Médenine: "Médenine",
};

/** Legacy / JAX / Arabic spellings → Calirex Jet option value. */
const GOVERNORATE_ALIASES: Record<string, TunisiaGovernorate> = {
  // Latin variants
  beja: "Béja",
  "béja": "Béja",
  gabes: "Gabès",
  "gabès": "Gabès",
  kebili: "Kébili",
  "kébili": "Kébili",
  manouba: "La Manouba",
  "la manouba": "La Manouba",
  kef: "Le Kef",
  "le kef": "Le Kef",
  lekef: "Le Kef",
  medenine: "Médenine",
  "médenine": "Médenine",
  "ben arous": "Ben Arous",
  // Arabic
  منوبة: "La Manouba",
  تونس: "Tunis",
  صفاقس: "Sfax",
  سوسة: "Sousse",
  نابل: "Nabeul",
  أريانة: "Ariana",
  بنعروس: "Ben Arous",
  "بن عروس": "Ben Arous",
  مدنين: "Médenine",
  قابس: "Gabès",
  الكاف: "Le Kef",
  باجة: "Béja",
};

/** City / alias hints → preferred delegation when exact match fails. */
const DELEGATION_ALIASES: Record<string, string> = {
  منوبة: "Mannouba",
  "oued eliil": "Oued Ellil",
  "oued elil": "Oued Ellil",
  "oued elliil": "Oued Ellil",
  "oued el lil": "Oued Ellil",
  mornaguia: "Mornaguia",
  ezzahrouni: "zahrouni",
  zahrouni: "zahrouni",
  "sidi hssine": "Sidi Hassine",
  "sidi hassine": "Sidi Hassine",
  mhamdia: "Mohamadia",
  mohammedia: "Mohamadia",
  "hay la3ti9": "Mohamadia",
  "بني خداش": "Beni Khedache",
  "beni khedache": "Beni Khedache",
  خليدية: "Ben Arous",
  "بن عروس": "Ben Arous",
  tunis: "Tunis",
  sfax: "Sfax Ville",
  nabeul: "Nabeul",
  hammamet: "Hammamet",
  ariana: "Ariana Ville",
  "ben arous": "Ben Arous",
  medenine: "Medenine Nord",
  "le kef": "Le Kef Est",
  kef: "Le Kef Est",
};

function foldKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function governorateLabel(value: string): string {
  const mapped = toCalirexGovernorate(value) || value;
  return GOVERNORATE_LABELS[mapped] ?? mapped;
}

/** Map any stored/legacy governorate to Calirex Jet option value. */
export function toCalirexGovernorate(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const exact = TUNISIA_GOVERNORATES.find((g) => g === trimmed);
  if (exact) return exact;

  const caseHit = TUNISIA_GOVERNORATES.find((g) => g.toLowerCase() === trimmed.toLowerCase());
  if (caseHit) return caseHit;

  const alias =
    GOVERNORATE_ALIASES[trimmed.toLowerCase()] || GOVERNORATE_ALIASES[foldKey(trimmed)];
  if (alias) return alias;

  const folded = foldKey(trimmed);
  const foldHit = TUNISIA_GOVERNORATES.find((g) => foldKey(g) === folded);
  return foldHit ?? null;
}

export function isTunisiaGovernorate(value: string | null | undefined): boolean {
  return toCalirexGovernorate(value) != null;
}

export function getCalirexDelegations(governorate: string | null | undefined): string[] {
  const gov = toCalirexGovernorate(governorate);
  if (!gov) return [];
  const list = (calirexDelegations as Record<string, string[]>)[gov];
  return Array.isArray(list) ? list : [];
}

/**
 * Pick a Calirex delegation from city/address text.
 * Falls back to a governorate default when nothing matches.
 */
export function resolveCalirexDelegation(
  governorate: string | null | undefined,
  city?: string | null,
  address?: string | null
): string | null {
  const gov = toCalirexGovernorate(governorate);
  if (!gov) return null;
  const options = getCalirexDelegations(gov);
  if (options.length === 0) return null;

  const cityText = (city || "").trim();
  const addressText = (address || "").trim();
  const blob = foldKey([cityText, addressText].filter(Boolean).join(" "));

  // 1) Exact / case-insensitive match on city or address
  for (const needle of [cityText, addressText]) {
    if (!needle) continue;
    const hit = options.find((o) => o === needle || o.toLowerCase() === needle.toLowerCase());
    if (hit) return hit;
    const folded = options.find((o) => foldKey(o) === foldKey(needle));
    if (folded) return folded;
  }

  // 2) Longest option name found inside city+address (e.g. "Oued eliil" ≈ Oued Ellil via alias step)
  let best: { opt: string; score: number } | null = null;
  for (const opt of options) {
    const fo = foldKey(opt);
    if (fo.length >= 3 && blob.includes(fo)) {
      if (!best || fo.length > best.score) best = { opt, score: fo.length };
    }
  }
  if (best) return best.opt;

  // 3) Alias tokens inside city/address (handles typos like "Oued eliil")
  let aliasBest: { opt: string; score: number } | null = null;
  for (const [alias, target] of Object.entries(DELEGATION_ALIASES)) {
    const fa = foldKey(alias);
    if (fa.length < 3 || !blob.includes(fa)) continue;
    const hit = options.find((o) => o === target || foldKey(o) === foldKey(target));
    if (!hit) continue;
    if (!aliasBest || fa.length > aliasBest.score) aliasBest = { opt: hit, score: fa.length };
  }
  if (aliasBest) return aliasBest.opt;

  // 4) Whole-city alias (e.g. منوبة → Mannouba)
  for (const raw of [cityText, addressText]) {
    if (!raw) continue;
    const target = DELEGATION_ALIASES[raw.toLowerCase()] || DELEGATION_ALIASES[foldKey(raw)];
    if (!target) continue;
    const hit = options.find((o) => o === target || foldKey(o) === foldKey(target));
    if (hit) return hit;
  }

  // 5) Delegation named like the governorate
  const govNamed = options.find(
    (o) => foldKey(o) === foldKey(gov) || foldKey(o).startsWith(foldKey(gov))
  );
  if (govNamed) return govNamed;

  return options[0] ?? null;
}
