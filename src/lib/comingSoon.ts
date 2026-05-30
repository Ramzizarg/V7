import { cache } from "react";
import { syncClientCachesWithDeployment } from "@/lib/appBuildId";
import { supabaseBrowserClient, supabaseServerOnlyClient } from "@/lib/supabaseClient";
import { uploadHomeImage } from "@/lib/uploadHeroImage";

export interface ComingSoonSettings {
  enabled: boolean;
  heroImageUrl: string;
  /** ISO string (timestamptz) or empty string when not set */
  endAt: string;
  requirePassword: boolean;
  /** Only used client-side to set a new password; never returned from DB */
  newPassword?: string;
}

export const defaultComingSoonSettings: ComingSoonSettings = {
  enabled: false,
  heroImageUrl: "",
  endAt: "",
  requirePassword: false,
  newPassword: "",
};

/** True when the site gate is on and the end date (if any) is still in the future. */
export function isComingSoonGateBlockingSite(settings: ComingSoonSettings): boolean {
  if (!settings.enabled) return false;
  if (settings.endAt) {
    const end = Date.parse(settings.endAt);
    if (!Number.isNaN(end) && end <= Date.now()) return false;
  }
  return true;
}

const STORAGE_KEY = "blacktephra-coming-soon-settings";
const ROW_ID = "default";

function mergeWithDefaults(partial: Partial<ComingSoonSettings> | null): ComingSoonSettings {
  if (!partial || typeof partial !== "object") return { ...defaultComingSoonSettings };
  return {
    enabled: Boolean(partial.enabled ?? defaultComingSoonSettings.enabled),
    heroImageUrl: typeof partial.heroImageUrl === "string" ? partial.heroImageUrl : defaultComingSoonSettings.heroImageUrl,
    endAt: String(partial.endAt ?? defaultComingSoonSettings.endAt),
    requirePassword: Boolean(partial.requirePassword ?? defaultComingSoonSettings.requirePassword),
    newPassword: "",
  };
}

type DbRow = {
  enabled: boolean;
  hero_image_url: string;
  end_at: string | null;
  require_password: boolean;
};

function fromDbRow(row: DbRow | null): ComingSoonSettings {
  if (!row) return { ...defaultComingSoonSettings };
  return mergeWithDefaults({
    enabled: row.enabled,
    heroImageUrl: row.hero_image_url ?? "",
    endAt: row.end_at ?? "",
    requirePassword: row.require_password,
  });
}

/** Get coming soon settings from Supabase (server-side only). Cached per request. */
export const getComingSoonSettingsServer = cache(async (): Promise<ComingSoonSettings> => {
  try {
    const supabase = supabaseServerOnlyClient();
    const { data, error } = await supabase
      .from("coming_soon_settings")
      .select("enabled,hero_image_url,end_at,require_password")
      .eq("id", ROW_ID)
      .single();
    if (!error && data) return fromDbRow(data as DbRow);
  } catch {
    // ignore
  }
  return { ...defaultComingSoonSettings };
});

/** Get coming soon settings from Supabase, then localStorage fallback, then defaults. */
export async function getComingSoonSettings(): Promise<ComingSoonSettings> {
  if (typeof window !== "undefined") syncClientCachesWithDeployment();
  try {
    const supabase = supabaseBrowserClient();
    const { data, error } = await supabase
      .from("coming_soon_settings")
      .select("enabled,hero_image_url,end_at,require_password")
      .eq("id", ROW_ID)
      .single();
    if (!error && data) {
      const merged = fromDbRow(data as DbRow);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {
    // ignore
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return mergeWithDefaults(JSON.parse(stored));
    } catch {
      // ignore
    }
  }

  return { ...defaultComingSoonSettings };
}

export async function saveComingSoonSettings(settings: ComingSoonSettings): Promise<void> {
  const payload = {
    id: ROW_ID,
    enabled: Boolean(settings.enabled),
    hero_image_url: settings.heroImageUrl || "",
    end_at: settings.endAt ? new Date(settings.endAt).toISOString() : null,
    require_password: Boolean(settings.requirePassword),
    updated_at: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabled: payload.enabled,
        heroImageUrl: payload.hero_image_url,
        endAt: payload.end_at ?? "",
        requirePassword: payload.require_password,
      } satisfies ComingSoonSettings)
    );
  }

  try {
    const supabase = supabaseBrowserClient();
    await supabase.from("coming_soon_settings").upsert(payload, { onConflict: "id" });
  } catch {
    // ignore
  }
}

export async function uploadComingSoonImage(file: File): Promise<string> {
  return uploadHomeImage("coming-soon", file);
}

