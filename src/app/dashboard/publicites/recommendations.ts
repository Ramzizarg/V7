import type { ComponentType } from "react";
import {
  Ban,
  Clock,
  CreditCard,
  Film,
  Layers,
  MousePointerClick,
  PackageCheck,
  PauseCircle,
  PlayCircle,
  Repeat,
  Rocket,
  ShoppingCart,
  Shuffle,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { CreativeRow, MetaAdsReport } from "@/lib/metaAds";
import { isActiveStatus, type Fmt } from "./adsUi";

type IconType = ComponentType<{ className?: string }>;

const DAY_MS = 86_400_000;

/** A creative is judged once it has spent this many times the target CPA. */
const TEST_BUDGET_MULTIPLIER = 2;

export type Verdict = "winner" | "promising" | "testing" | "watch" | "loser";

export const VERDICT_ORDER: Verdict[] = ["winner", "promising", "testing", "watch", "loser"];

export const VERDICTS: Record<
  Verdict,
  { label: string; short: string; description: string; chip: string; soft: string; bar: string }
> = {
  winner: {
    label: "Gagnantes",
    short: "Gagnante",
    description: "Rentables : à scaler",
    chip: "bg-emerald-500 text-white",
    soft: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bar: "bg-emerald-500",
  },
  promising: {
    label: "Prometteuses",
    short: "Prometteuse",
    description: "Bons signaux : laisser tourner",
    chip: "bg-teal-500 text-white",
    soft: "border-teal-200 bg-teal-50 text-teal-800",
    bar: "bg-teal-500",
  },
  testing: {
    label: "Pas assez testées",
    short: "Pas assez testée",
    description: "Trop peu de dépense pour juger",
    chip: "bg-blue-500 text-white",
    soft: "border-blue-200 bg-blue-50 text-blue-800",
    bar: "bg-blue-500",
  },
  watch: {
    label: "À surveiller",
    short: "À surveiller",
    description: "Résultats moyens : décision bientôt",
    chip: "bg-amber-500 text-white",
    soft: "border-amber-200 bg-amber-50 text-amber-800",
    bar: "bg-amber-500",
  },
  loser: {
    label: "À couper",
    short: "À couper",
    description: "Dépensent sans être rentables",
    chip: "bg-red-500 text-white",
    soft: "border-red-200 bg-red-50 text-red-800",
    bar: "bg-red-500",
  },
};

export type AnalysisContext = {
  targetCpa: number | null;
  avgCtr: number;
  avgCpm: number | null;
  now: number;
};

export type CreativeAnalysis = {
  verdict: Verdict;
  headline: string;
  reasons: string[];
  actions: string[];
  test: { spent: number; needed: number } | null;
  daysLive: number | null;
  cutTooEarly: boolean;
};

export function buildContext(report: MetaAdsReport, targetCpa: number | null): AnalysisContext {
  return {
    targetCpa,
    avgCtr: report.totals.ctr,
    avgCpm: report.totals.cpm,
    now: Date.parse(report.fetchedAt) || 0,
  };
}

export function periodDays(report: MetaAdsReport) {
  if (!report.range) return null;
  const start = Date.parse(`${report.range.since}T00:00:00Z`);
  const end = Date.parse(`${report.range.until}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / DAY_MS) + 1;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function diagnostics(c: CreativeRow, ctx: AnalysisContext, fmt: Fmt) {
  const out: string[] = [];
  if (c.impressions >= 1000) {
    if (c.ctr < Math.min(0.8, ctx.avgCtr * 0.7)) {
      out.push(
        `CTR faible (${fmt.pct(c.ctr)}) : l'accroche ne retient pas. Changer les 3 premières secondes ou le visuel principal.`
      );
    } else if (ctx.avgCtr > 0 && c.ctr >= ctx.avgCtr * 1.3) {
      out.push(`Très bon CTR (${fmt.pct(c.ctr)}) : l'accroche fonctionne.`);
    }
  }
  if (c.linkClicks >= 30 && c.addToCart / c.linkClicks < 0.03) {
    out.push(
      `Beaucoup de clics mais peu d'ajouts panier (${fmt.pct((c.addToCart / c.linkClicks) * 100, 1)}) : décalage entre la pub et la page produit (prix, photos, tailles).`
    );
  }
  if (c.addToCart >= 3 && c.purchases === 0) {
    out.push(
      `${plural(c.addToCart, "ajout")} panier sans achat : vérifier le formulaire de commande et les frais de livraison.`
    );
  }
  if (ctx.avgCpm && c.cpm && c.impressions >= 1000 && c.cpm > ctx.avgCpm * 1.5) {
    out.push(`CPM élevé (${fmt.money(c.cpm)}) : créa jugée peu engageante par Meta ou audience chère.`);
  }
  if (c.frequency != null && c.frequency >= 3) {
    out.push(`Fréquence ${fmt.dec(c.frequency, 1)} : les mêmes personnes la voient trop, risque de lassitude.`);
  }
  return out;
}

export function analyzeCreative(c: CreativeRow, ctx: AnalysisContext, fmt: Fmt): CreativeAnalysis {
  const T = ctx.targetCpa;
  const created = c.createdTime ? Date.parse(c.createdTime) : NaN;
  const daysLive = Number.isFinite(created) && ctx.now ? Math.max(0, Math.floor((ctx.now - created) / DAY_MS)) : null;
  const active = isActiveStatus(c.status);
  const reasons = diagnostics(c, ctx, fmt);
  const cpa = c.costPerPurchase;
  const base = { reasons, daysLive, cutTooEarly: false };

  if (T == null || T <= 0) {
    if (c.purchases > 0) {
      return {
        ...base,
        verdict: "promising",
        headline: `${plural(c.purchases, "achat")} à ${fmt.money(cpa)}`,
        actions: ["Définissez un CPA cible pour obtenir un verdict précis."],
        test: null,
      };
    }
    return {
      ...base,
      verdict: c.impressions < 2000 ? "testing" : "watch",
      headline: `${fmt.money(c.spend)} dépensés, aucun achat`,
      actions: ["Définissez un CPA cible pour savoir quand couper ou garder cette pub."],
      test: null,
    };
  }

  const needed = TEST_BUDGET_MULTIPLIER * T;

  if (c.purchases >= 2 && cpa != null && cpa <= T) {
    const actions = [
      "Augmenter le budget de 20 % tous les 2–3 jours (pas plus, pour ne pas relancer l'apprentissage).",
      "Créer 2–3 variantes : nouvelle accroche, autre format (vidéo / carrousel), autre texte.",
      "La dupliquer dans une campagne de scaling (CBO ou Advantage+ Shopping).",
    ];
    if (!active) actions.unshift("Elle est en pause alors qu'elle est rentable : la réactiver.");
    return {
      ...base,
      verdict: "winner",
      headline: `${plural(c.purchases, "achat")} à ${fmt.money(cpa)} (cible ${fmt.money(T)})`,
      actions,
      test: null,
    };
  }

  if (c.purchases === 0 && c.spend >= needed) {
    const actions = active ? ["Couper la pub."] : ["Déjà en pause : bonne décision."];
    if (c.impressions >= 1000 && c.ctr >= ctx.avgCtr) {
      actions.push("Le CTR est bon : garder l'angle et tester une nouvelle accroche ou une autre offre.");
    } else {
      actions.push("Tester un angle complètement différent plutôt qu'une petite variante.");
    }
    return {
      ...base,
      verdict: "loser",
      headline: `${fmt.money(c.spend)} dépensés sans achat (≥ ${TEST_BUDGET_MULTIPLIER}× le CPA cible)`,
      actions,
      test: null,
    };
  }

  if (c.purchases >= 1 && cpa != null && cpa > 1.8 * T && c.spend >= 3 * T) {
    return {
      ...base,
      verdict: "loser",
      headline: `Coût/achat ${fmt.money(cpa)} : ${fmt.dec(cpa / T, 1)}× la cible`,
      actions: active
        ? ["Couper ou baisser fortement le budget.", "Réutiliser ce qui marche (accroche, visuel) dans une nouvelle version."]
        : ["Déjà en pause : bonne décision.", "Réutiliser ce qui marche (accroche, visuel) dans une nouvelle version."],
      test: null,
    };
  }

  if (c.purchases >= 1 && cpa != null && cpa <= 1.3 * T) {
    return {
      ...base,
      verdict: "promising",
      headline: `${plural(c.purchases, "achat")} à ${fmt.money(cpa)} (cible ${fmt.money(T)})`,
      actions: [
        "Laisser tourner sans la modifier.",
        `Réévaluer après ${fmt.money(Math.max(needed * 1.5, c.spend + T))} de dépense : elle devient gagnante avec 2 achats sous la cible.`,
      ],
      test: null,
    };
  }

  if (c.purchases === 0 && c.spend < T) {
    const test = { spent: c.spend, needed };
    const strongSignals = c.impressions >= 500 && c.ctr >= ctx.avgCtr * 1.2 && c.addToCart >= 1;
    let actions: string[];
    let cutTooEarly = false;
    if (!active) {
      cutTooEarly = true;
      actions = [
        "Coupée avant d'avoir été vraiment testée.",
        `Si l'angle est nouveau, la relancer jusqu'à ${fmt.money(needed)} de dépense avant de juger.`,
      ];
    } else if (daysLive != null && daysLive >= 3 && c.spend < 0.3 * T) {
      actions = [
        "Meta lui donne très peu de budget face aux autres pubs du même ad set.",
        "La tester seule dans un ad set dédié (ABO) avec un budget fixe.",
      ];
    } else {
      actions = [
        `Ne rien décider avant ${fmt.money(needed)} de dépense (≈ ${TEST_BUDGET_MULTIPLIER}× le CPA cible).`,
        "Éviter de la modifier pendant le test.",
      ];
    }
    if (strongSignals) actions.push("Bons signaux (CTR, paniers) : à suivre de près.");
    return {
      ...base,
      cutTooEarly,
      verdict: "testing",
      headline: `${fmt.money(c.spend)} dépensés sur ${fmt.money(needed)} nécessaires pour juger`,
      actions,
      test,
    };
  }

  if (c.purchases === 0 && c.impressions >= 500 && c.ctr >= ctx.avgCtr * 1.2 && c.addToCart >= 2) {
    return {
      ...base,
      verdict: "promising",
      headline: "Pas encore d'achat mais bons signaux (CTR, paniers)",
      actions: [`Laisser tourner jusqu'à ${fmt.money(needed)} de dépense.`],
      test: { spent: c.spend, needed },
    };
  }

  if (c.purchases === 0) {
    return {
      ...base,
      verdict: "watch",
      headline: `${fmt.money(c.spend)} sans achat — limite à ${fmt.money(needed)}`,
      actions: [`Couper si toujours aucun achat à ${fmt.money(needed)} de dépense.`],
      test: { spent: c.spend, needed },
    };
  }

  return {
    ...base,
    verdict: "watch",
    headline: `Coût/achat ${fmt.money(cpa)} au-dessus de la cible (${fmt.money(T)})`,
    actions: ["Laisser 1–2 jours de plus, puis couper si le coût/achat ne baisse pas."],
    test: null,
  };
}

export type Recommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  icon: IconType;
  title: string;
  detail: string;
  impact?: string;
  verdict?: Verdict;
};

function names(list: CreativeRow[], max = 3) {
  const shown = list.slice(0, max).map((c) => `« ${c.name} »`);
  return list.length > max ? `${shown.join(", ")} +${list.length - max}` : shown.join(", ");
}

export function buildActionPlan(
  report: MetaAdsReport,
  analyses: Map<string, CreativeAnalysis>,
  ctx: AnalysisContext,
  fmt: Fmt
): Recommendation[] {
  const { totals, creatives, campaigns } = report;
  const T = ctx.targetCpa;
  const days = periodDays(report) ?? 0;
  const by = (v: Verdict) => creatives.filter((c) => analyses.get(c.id)?.verdict === v);
  const out: Recommendation[] = [];

  const winners = by("winner");
  const losers = by("loser");
  const testing = by("testing");

  const activeLosers = losers.filter((c) => isActiveStatus(c.status)).sort((a, b) => b.spend - a.spend);
  if (activeLosers.length) {
    out.push({
      id: "cut-losers",
      priority: "high",
      icon: Ban,
      title: `Couper ${plural(activeLosers.length, "pub")} perdante${activeLosers.length > 1 ? "s" : ""}`,
      detail: names(activeLosers),
      impact: `${fmt.money(activeLosers.reduce((s, c) => s + c.spend, 0))} dépensés sans rentabilité sur la période`,
      verdict: "loser",
    });
  }

  const pausedWinners = winners.filter((c) => !isActiveStatus(c.status));
  if (pausedWinners.length) {
    out.push({
      id: "reactivate-winners",
      priority: "high",
      icon: PlayCircle,
      title: `Réactiver ${plural(pausedWinners.length, "gagnante")} en pause`,
      detail: `${names(pausedWinners)} : rentable${pausedWinners.length > 1 ? "s" : ""} mais coupée${pausedWinners.length > 1 ? "s" : ""}.`,
      verdict: "winner",
    });
  }

  const activeWinners = winners.filter((c) => isActiveStatus(c.status));
  if (activeWinners.length) {
    out.push({
      id: "scale-winners",
      priority: "high",
      icon: Rocket,
      title: `Scaler ${plural(activeWinners.length, "créa")} gagnante${activeWinners.length > 1 ? "s" : ""}`,
      detail: `Budget +20 % tous les 2–3 jours et 2–3 variantes de ${names(activeWinners)}.`,
      verdict: "winner",
    });
  }

  if (!winners.length && creatives.length && T != null && days >= 3) {
    out.push({
      id: "no-winner",
      priority: "high",
      icon: Sparkles,
      title: "Aucune créa gagnante sur la période",
      detail:
        "Lancez 3–5 nouveaux angles très différents : UGC / témoignage, avant-après, produit porté en situation, offre limitée, focus détails en vidéo.",
    });
  }

  if (winners.length && totals.spend > 0 && totals.purchases > 0) {
    const winSpend = winners.reduce((s, c) => s + c.spend, 0) / totals.spend;
    const winPurchases = winners.reduce((s, c) => s + c.purchases, 0) / totals.purchases;
    if (winSpend < 0.4 && winPurchases > winSpend) {
      out.push({
        id: "shift-budget",
        priority: "medium",
        icon: Shuffle,
        title: "Déplacer le budget vers les gagnantes",
        detail: `Elles reçoivent ${fmt.pct(winSpend * 100, 0)} des dépenses mais font ${fmt.pct(winPurchases * 100, 0)} des achats.`,
        verdict: "winner",
      });
    }
  }

  if (T != null) {
    const cutEarly = testing.filter((c) => analyses.get(c.id)?.cutTooEarly);
    if (cutEarly.length) {
      out.push({
        id: "cut-too-early",
        priority: "medium",
        icon: PauseCircle,
        title: `${plural(cutEarly.length, "créa")} coupée${cutEarly.length > 1 ? "s" : ""} trop tôt`,
        detail: `Mises en pause avant ${fmt.money(TEST_BUDGET_MULTIPLIER * T)} de dépense : impossible de savoir si elles marchaient. ${names(cutEarly)}.`,
        verdict: "testing",
      });
    }

    const activeAds = creatives.filter((c) => isActiveStatus(c.status));
    const perAd = activeAds.length ? totals.spend / activeAds.length : 0;
    if (activeAds.length >= 5 && perAd < T) {
      out.push({
        id: "too-many-tests",
        priority: "medium",
        icon: Layers,
        title: "Trop de créas en même temps pour votre budget",
        detail: `${activeAds.length} pubs actives pour ${fmt.money(totals.spend)} : environ ${fmt.money(perAd)} chacune. Gardez 3–5 créas par ad set pour que chacune atteigne ${fmt.money(TEST_BUDGET_MULTIPLIER * T)}.`,
        verdict: "testing",
      });
    }
  }

  const createdTimes = creatives.map((c) => (c.createdTime ? Date.parse(c.createdTime) : NaN)).filter(Number.isFinite);
  if (createdTimes.length && ctx.now) {
    const newestDays = Math.floor((ctx.now - Math.max(...createdTimes)) / DAY_MS);
    if (newestDays >= 10) {
      out.push({
        id: "refresh",
        priority: "medium",
        icon: Clock,
        title: `Pas de nouvelle créa depuis ${newestDays} jours`,
        detail: "Testez 2–3 nouvelles créas chaque semaine pour garder un coût par achat stable.",
      });
    }
  }

  if (totals.linkClicks >= 100 && totals.addToCart / totals.linkClicks < 0.05) {
    out.push({
      id: "atc-rate",
      priority: "high",
      icon: ShoppingCart,
      title: "Les visiteurs n'ajoutent pas au panier",
      detail: `Seulement ${fmt.pct((totals.addToCart / totals.linkClicks) * 100, 1)} des clics. Améliorez la page produit : photos portées, guide des tailles, prix barré, avis clients, livraison visible.`,
    });
  }

  if (totals.addToCart >= 10 && totals.purchases / totals.addToCart < 0.25) {
    out.push({
      id: "checkout",
      priority: "medium",
      icon: CreditCard,
      title: "Beaucoup de paniers abandonnés",
      detail: `Seulement ${fmt.pct((totals.purchases / totals.addToCart) * 100, 0)} des paniers deviennent des commandes. Simplifiez le formulaire, affichez les frais de livraison tôt, rassurez sur le paiement à la livraison.`,
    });
  }

  if (totals.impressions >= 5000 && totals.ctr < 1) {
    out.push({
      id: "ctr",
      priority: "medium",
      icon: MousePointerClick,
      title: "CTR global faible",
      detail: `${fmt.pct(totals.ctr)} en moyenne. Travaillez les accroches : texte fort dans la 1re seconde, visage, mouvement, prix ou offre visible.`,
    });
  }

  if (days >= 7 && totals.frequency != null && totals.frequency >= 2.5) {
    out.push({
      id: "frequency",
      priority: "medium",
      icon: Repeat,
      title: "Audience saturée",
      detail: `Fréquence de ${fmt.dec(totals.frequency, 1)} : élargissez l'audience (Advantage+) et renouvelez les créas.`,
    });
  }

  if (totals.purchases > 0 && totals.purchaseValue === 0) {
    out.push({
      id: "purchase-value",
      priority: "medium",
      icon: Wallet,
      title: "Valeur des achats manquante",
      detail: "Meta ne reçoit pas le montant des commandes : impossible d'optimiser sur le ROAS.",
    });
  }

  const group = (video: boolean) => {
    const list = creatives.filter((c) => c.isVideo === video);
    const spend = list.reduce((s, c) => s + c.spend, 0);
    const purchases = list.reduce((s, c) => s + c.purchases, 0);
    return { purchases, cpa: purchases > 0 ? spend / purchases : null };
  };
  const videos = group(true);
  const images = group(false);
  if (videos.cpa != null && images.cpa != null && videos.purchases >= 2 && images.purchases >= 2) {
    const videoBetter = videos.cpa < images.cpa;
    const ratio = videoBetter ? images.cpa / videos.cpa : videos.cpa / images.cpa;
    if (ratio >= 1.3) {
      out.push({
        id: "format",
        priority: "low",
        icon: Film,
        title: videoBetter ? "Les vidéos convertissent mieux" : "Les images convertissent mieux",
        detail: `Coût/achat ${fmt.money(videoBetter ? videos.cpa : images.cpa)} contre ${fmt.money(videoBetter ? images.cpa : videos.cpa)}. Produisez plus de ${videoBetter ? "vidéos" : "visuels statiques"}.`,
      });
    }
  }

  if (T != null) {
    const spending = campaigns.filter((c) => c.spend > 0);
    if (spending.length >= 4 && totals.spend / spending.length < 3 * T) {
      out.push({
        id: "consolidate",
        priority: "low",
        icon: Layers,
        title: "Regrouper les campagnes",
        detail: `${spending.length} campagnes se partagent le budget. Moins de campagnes (CBO / Advantage+) = sortie plus rapide de l'apprentissage.`,
      });
    }
  }

  if (totals.purchases > 0) {
    out.push({
      id: "cod",
      priority: "low",
      icon: PackageCheck,
      title: "Comparer avec les livraisons réelles",
      detail:
        "Les achats Meta sont des commandes passées. Comparez avec les commandes livrées (Analytiques) pour connaître votre vrai coût par commande livrée.",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
