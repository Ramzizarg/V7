import { cache } from "react";
import { syncClientCachesWithDeployment } from "@/lib/appBuildId";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export interface HomeProduct {
  product_id?: number | null;
  name: string;
  price: string;
}

/** 0 = left, 50 = center, 100 = right. Fine control for mobile hero image. */
export interface HomeContent {
  /**
   * Carousel images for the homepage hero.
   * If missing in old saved data, it will be derived from `heroImageUrl`.
   */
  heroImageUrls: string[];
  heroImageUrl: string;
  /** Mobile hero horizontal position (0–100). Legacy: "left"|"center"|"right" converted in mergeWithDefaults. */
  heroImagePositionMobile: number | "left" | "center" | "right";
  heroSubtitle: string;
  heroSubtitleColor: string;
  heroCollection: string;
  heroCollectionColor: string;
  heroHeadline: string;
  heroHeadlineColor: string;
  heroDescription: string;
  heroDescriptionColor: string;
  heroButtonText: string;
  heroButtonTextColor: string;
  carouselTitle: string;
  products: HomeProduct[];
  category1Name: string;
  category1ImageUrl: string;
  category2Name: string;
  category2ImageUrl: string;
  newsletterText: string;
  socialHandle: string;
  /** Phrases du bandeau (top announcement), une par élément */
  bannerPhrases: string[];
}

export const defaultHomeContent: HomeContent = {
  heroImageUrls: [],
  heroImageUrl: "",
  heroImagePositionMobile: 50,
  heroSubtitle: "Nouveauté",
  heroSubtitleColor: "#ffffff",
  heroCollection: "Collection Sport x Casual",
  heroCollectionColor: "#ffffff",
  heroHeadline: "Renverse Les Regles",
  heroHeadlineColor: "#ffffff",
  heroDescription: "Signe par Vero7.",
  heroDescriptionColor: "#999999",
  heroButtonText: "SHOP NOW",
  heroButtonTextColor: "#000000",
  carouselTitle: "The Latest Arrivals",
  products: [
    { product_id: null, name: "Oversized Hoodie", price: "120.00 DT" },
    { product_id: null, name: "Tech Fleece", price: "110.00 DT" },
  ],
  category1Name: "All New",
  category1ImageUrl: "",
  category2Name: "SweatShirts",
  category2ImageUrl: "",
  newsletterText: "Sign up to our newsletter & get a gift on your birthday",
  socialHandle: "@Vero7",
  bannerPhrases: [
    "Retours faciles",
    "Qualité premium",
    "Club Vero7",
    "Nouvelle collection",
    "Streetwear & sport",
  ],
};

const STORAGE_KEY = "blacktephra-home-content";
const ROW_ID = "default";
let homeContentTableMissing = false;

function isMissingHomeContentTableMessage(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("home_content") && (m.includes("42p01") || m.includes("does not exist"));
}

function toPositionNumber(v: number | "left" | "center" | "right" | undefined): number {
  if (typeof v === "number" && v >= 0 && v <= 100) return v;
  if (v === "left") return 0;
  if (v === "right") return 100;
  return 50;
}

function mergeWithDefaults(partial: Partial<HomeContent> | null): HomeContent {
  if (!partial || typeof partial !== "object") return { ...defaultHomeContent };
  const merged = { ...defaultHomeContent, ...partial };
  merged.heroImagePositionMobile = toPositionNumber(merged.heroImagePositionMobile as number | "left" | "center" | "right");
  if (!Array.isArray(merged.bannerPhrases) || merged.bannerPhrases.length === 0) {
    merged.bannerPhrases = [...defaultHomeContent.bannerPhrases];
  }
  // Backward compatibility: older data only had `heroImageUrl`.
  if ((!Array.isArray(merged.heroImageUrls) || merged.heroImageUrls.length === 0) && merged.heroImageUrl?.trim()) {
    merged.heroImageUrls = [merged.heroImageUrl.trim()];
  }
  // If the new array exists, ensure the legacy field points to the first element.
  if (Array.isArray(merged.heroImageUrls) && merged.heroImageUrls.length > 0) {
    merged.heroImageUrl = merged.heroImageUrls[0] ?? "";
  }
  return merged;
}

/** Load CMS home row from Neon (works on server — no relative /api fetch). */
async function loadHomeContentFromDatabase(): Promise<HomeContent | null> {
  if (homeContentTableMissing || !resolveDatabaseUrl()) return null;
  try {
    const { rows } = await neonQuery<{ content: unknown }>(
      `SELECT content FROM home_content WHERE id = $1 LIMIT 1`,
      [ROW_ID]
    );
    const raw = rows?.[0]?.content;
    if (raw && typeof raw === "object") {
      return mergeWithDefaults(raw as Partial<HomeContent>);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (isMissingHomeContentTableMessage(message)) {
      homeContentTableMissing = true;
    }
  }
  return null;
}

/** Server-side home CMS (first paint on reload). Cached per request. */
export const getHomeContentServer = cache(async (): Promise<HomeContent> => {
  const fromDb = await loadHomeContentFromDatabase();
  return fromDb ?? { ...defaultHomeContent };
});

/** Get home content from Supabase, then localStorage fallback, then defaults. */
export async function getHomeContent(): Promise<HomeContent> {
  if (homeContentTableMissing) {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return mergeWithDefaults(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    return defaultHomeContent;
  }

  try {
    const supabase = supabaseBrowserClient();
    const { data, error } = await supabase
      .from("home_content")
      .select("content")
      .eq("id", ROW_ID)
      .single();
    if (error && isMissingHomeContentTableMessage(error.message)) {
      homeContentTableMissing = true;
    }

    if (!error && data?.content) {
      const merged = mergeWithDefaults(data.content as Partial<HomeContent>);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch {
    // Supabase not configured or network error
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return mergeWithDefaults(JSON.parse(stored));
    } catch {
      // ignore
    }
  }

  return defaultHomeContent;
}

/** Fast client-side read to avoid first-render flicker on homepage reload. */
export function getCachedHomeContentSync(): HomeContent | null {
  if (typeof window === "undefined") return null;
  syncClientCachesWithDeployment();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return mergeWithDefaults(JSON.parse(stored));
  } catch {
    return null;
  }
}

/** Save home content to Supabase and to localStorage as cache. */
export async function saveHomeContent(content: HomeContent): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  }

  if (homeContentTableMissing) return;

  try {
    const supabase = supabaseBrowserClient();
    const { error } = await supabase
      .from("home_content")
      .upsert(
        { id: ROW_ID, content: content, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    if (error && isMissingHomeContentTableMessage(error.message)) {
      homeContentTableMissing = true;
    }
  } catch {
    // Supabase not configured or network error; localStorage already updated
  }
}
