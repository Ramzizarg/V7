import { cache } from "react";
import { supabaseBrowserClient, supabaseServerOnlyClient } from "@/lib/supabaseClient";

export interface HomeProduct {
  product_id?: number | null;
  name: string;
  price: string;
}

/** 0 = left, 50 = center, 100 = right. Fine control for mobile hero image. */
export interface HomeContent {
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
  heroImageUrl: "",
  heroImagePositionMobile: 50,
  heroSubtitle: "New in",
  heroSubtitleColor: "#ffffff",
  heroCollection: "SPRING COLLECTION",
  heroCollectionColor: "#ffffff",
  heroHeadline: "BUILT RAW.\nWORN FORWARD.",
  heroHeadlineColor: "#ffffff",
  heroDescription: "BlackTephra isn't inspired by form. It's built from it.",
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
  socialHandle: "@BlackTephra",
  bannerPhrases: [
    "Easy Returns",
    "Highest Quality Since 2026",
    "BlackTephra Club",
    "New Collection Available",
    "Premium Streetwear",
  ],
};

const STORAGE_KEY = "blacktephra-home-content";
const ROW_ID = "default";

function toPositionNumber(v: number | "left" | "center" | "right" | undefined): number {
  if (typeof v === "number" && v >= 0 && v <= 100) return v;
  if (v === "left") return 0;
  if (v === "right") return 100;
  return 50;
}

function mergeWithDefaults(partial: Partial<HomeContent> | null): HomeContent {
  if (!partial || typeof partial !== "object") return defaultHomeContent;
  const merged = { ...defaultHomeContent, ...partial };
  merged.heroImagePositionMobile = toPositionNumber(merged.heroImagePositionMobile as number | "left" | "center" | "right");
  merged.category1Name = defaultHomeContent.category1Name;
  merged.category2Name = defaultHomeContent.category2Name;
  if (!Array.isArray(merged.bannerPhrases) || merged.bannerPhrases.length === 0) {
    merged.bannerPhrases = [...defaultHomeContent.bannerPhrases];
  }
  return merged;
}

/** Get home content from Supabase (server-side only). Cached per request so safe to call from page + generateMetadata. */
export const getHomeContentServer = cache(async (): Promise<HomeContent> => {
  try {
    const supabase = supabaseServerOnlyClient();
    const { data, error } = await supabase
      .from("home_content")
      .select("content")
      .eq("id", ROW_ID)
      .single();
    if (!error && data?.content) return mergeWithDefaults(data.content as Partial<HomeContent>);
  } catch {
    // Supabase not configured or network error
  }
  return defaultHomeContent;
});

/** Get home content from Supabase, then localStorage fallback, then defaults. */
export async function getHomeContent(): Promise<HomeContent> {
  try {
    const supabase = supabaseBrowserClient();
    const { data, error } = await supabase
      .from("home_content")
      .select("content")
      .eq("id", ROW_ID)
      .single();

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

/** Save home content to Supabase and to localStorage as cache. */
export async function saveHomeContent(content: HomeContent): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  }

  try {
    const supabase = supabaseBrowserClient();
    await supabase
      .from("home_content")
      .upsert(
        { id: ROW_ID, content: content, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
  } catch {
    // Supabase not configured or network error; localStorage already updated
  }
}
