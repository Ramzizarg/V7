/**
 * Calirex TN delivery API client
 * Docs: https://client.calirextn.com/Api/documentation.html
 *
 * Credentials: env (CALIREX_*) first, then Neon `app_settings` fallback
 * so production works even if Vercel env vars are missing.
 */

import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";

const DEFAULT_BASE = "https://client.calirextn.com/Api";

export type CalirexCreateColisInput = {
  nom_client: string;
  tel_client: string;
  adresse_client: string;
  gouvernorat_client: string;
  prix: number;
  nb_pieces: number;
  designation: string;
  delegation_client?: string;
  localite_client?: string;
  commentaire_client?: string;
  poids?: number;
  echange?: "oui" | "non";
  type_colis?: string;
  fragile?: "oui" | "non";
  tel2_client?: string;
  date_livraison?: string;
  horaire_livraison?: string;
  codeClient?: string;
  ouvcolis?: 0 | 1;
};

export type CalirexEtatEvent = {
  id?: number;
  idcolis?: number;
  etat?: string;
  date?: string;
  description?: string;
  lieu?: string;
  PROBLEME?: string;
};

export type CalirexColisDetail = {
  colis?: Record<string, unknown> & {
    id?: number;
    code_colis?: string;
    etat?: string;
    nb_pieces?: number;
    prix?: number;
  };
  etat_colis?: CalirexEtatEvent[];
};

function stripEnvQuotes(value: string) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

type CalirexCreds = { login: string; password: string; baseUrl: string };

let cachedDbCreds: { value: CalirexCreds; expiresAt: number } | null = null;

async function loadDbCredentials(): Promise<Partial<CalirexCreds>> {
  if (!resolveDatabaseUrl()) return {};
  if (cachedDbCreds && cachedDbCreds.expiresAt > Date.now()) {
    return cachedDbCreds.value;
  }
  try {
    const { rows } = await neonQuery<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings
       WHERE key IN ('calirex_login', 'calirex_password', 'calirex_api_base')`
    );
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const value: CalirexCreds = {
      login: (map.get("calirex_login") || "").trim(),
      password: (map.get("calirex_password") || "").trim(),
      baseUrl: (map.get("calirex_api_base") || DEFAULT_BASE).trim() || DEFAULT_BASE,
    };
    cachedDbCreds = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
    return value;
  } catch {
    return {};
  }
}

async function resolveCalirexConfig(): Promise<CalirexCreds> {
  const envLogin = stripEnvQuotes(process.env.CALIREX_LOGIN ?? "");
  const envPassword = stripEnvQuotes(process.env.CALIREX_PASSWORD ?? "");
  const envBase = stripEnvQuotes(process.env.CALIREX_API_BASE ?? "");

  if (envLogin && envPassword) {
    return {
      login: envLogin,
      password: envPassword,
      baseUrl: (envBase || DEFAULT_BASE).replace(/\/$/, ""),
    };
  }

  const db = await loadDbCredentials();
  const login = envLogin || db.login || "";
  const password = envPassword || db.password || "";
  const baseUrl = (envBase || db.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  if (!login || !password) {
    throw new Error(
      "Configuration Calirex manquante. Ajoutez CALIREX_LOGIN / CALIREX_PASSWORD sur Vercel, ou dans app_settings."
    );
  }
  return { login, password, baseUrl };
}

export async function isCalirexConfigured(): Promise<boolean> {
  try {
    await resolveCalirexConfig();
    return true;
  } catch {
    return false;
  }
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Réponse Calirex invalide (${res.status}): ${text.slice(0, 200)}`);
  }
}

function asError(data: Record<string, unknown>, fallback: string) {
  const err = data.error ?? data.message ?? data.msg;
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** POST /get_token — auth token (cached ~50 min). */
export async function calirexGetToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const { login, password, baseUrl } = await resolveCalirexConfig();
  const body = new URLSearchParams({ login, password });
  const urls = [`${baseUrl}/get_token.php`, `${baseUrl}/get_token`];

  let lastError = "Impossible d'obtenir le token Calirex.";
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      });
      const data = await parseJsonSafe(res);
      const token = typeof data.token === "string" ? data.token.trim() : "";
      if (token) {
        cachedToken = { value: token, expiresAt: Date.now() + 50 * 60 * 1000 };
        return token;
      }
      lastError = asError(data, lastError);
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }
  throw new Error(lastError);
}

async function withTokenRetry<T>(fn: (token: string, baseUrl: string) => Promise<T>): Promise<T> {
  const cfg = await resolveCalirexConfig();
  const token = await calirexGetToken();
  try {
    return await fn(token, cfg.baseUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    if (msg.includes("token")) {
      const fresh = await calirexGetToken(true);
      return await fn(fresh, cfg.baseUrl);
    }
    throw e;
  }
}

/** POST /createcolis.php — create parcel, returns code_colis (CAL…). */
export async function calirexCreateColis(input: CalirexCreateColisInput): Promise<string> {
  return withTokenRetry(async (token, baseUrl) => {
    const params = new URLSearchParams();
    params.set("token", token);
    params.set("nom_client", input.nom_client);
    params.set("tel_client", input.tel_client);
    params.set("adresse_client", input.adresse_client);
    params.set("gouvernorat_client", input.gouvernorat_client);
    params.set("prix", String(Math.round(Number(input.prix) || 0)));
    params.set("nb_pieces", String(Math.max(1, Math.floor(Number(input.nb_pieces) || 1))));
    params.set("designation", input.designation);
    if (input.delegation_client) params.set("delegation_client", input.delegation_client);
    if (input.localite_client) params.set("localite_client", input.localite_client);
    if (input.commentaire_client) params.set("commentaire_client", input.commentaire_client);
    if (input.poids != null) params.set("poids", String(input.poids));
    if (input.echange) params.set("echange", input.echange);
    if (input.type_colis) params.set("type_colis", input.type_colis);
    if (input.fragile) params.set("fragile", input.fragile);
    if (input.tel2_client) params.set("tel2_client", input.tel2_client);
    if (input.date_livraison) params.set("date_livraison", input.date_livraison);
    if (input.horaire_livraison) params.set("horaire_livraison", input.horaire_livraison);
    if (input.codeClient) params.set("codeClient", input.codeClient);
    if (input.ouvcolis != null) params.set("ouvcolis", String(input.ouvcolis));

    const res = await fetch(`${baseUrl}/createcolis.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
    });
    const data = await parseJsonSafe(res);
    const code =
      (typeof data.code_colis === "string" && data.code_colis) ||
      (typeof data.codecolis === "string" && data.codecolis) ||
      "";
    if (!code) throw new Error(asError(data, "Création colis Calirex échouée."));
    return code.trim();
  });
}

function extractHrefFromHtml(html: string | null | undefined): string | null {
  if (!html || typeof html !== "string") return null;
  const m = html.match(/href=['"]([^'"]+)['"]/i);
  if (!m?.[1]) return null;
  let href = m[1].replace(/\\\//g, "/");
  if (href.startsWith("//")) href = `https:${href}`;
  if (href.startsWith("/")) href = `https://client.calirextn.com${href}`;
  return href;
}

export type CalirexBonLivraison = {
  id_colis?: string;
  download_link: string | null;
  raw?: Record<string, unknown>;
};

/** GET /getbonlivraison.php — delivery note / bordereau PDF link. */
export async function calirexGetBonLivraison(codeColis: string): Promise<CalirexBonLivraison> {
  return withTokenRetry(async (token, baseUrl) => {
    const qs = new URLSearchParams({ token, codecolis: codeColis });
    const res = await fetch(`${baseUrl}/getbonlivraison.php?${qs}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = await parseJsonSafe(res);
    if (data.error) throw new Error(asError(data, "Bon de livraison introuvable."));

    const direct =
      (typeof data.download_link === "string" && data.download_link) ||
      (typeof data.url === "string" && data.url) ||
      null;
    const fromHtml = extractHrefFromHtml(
      typeof data.download_button_html === "string" ? data.download_button_html : null
    );

    return {
      id_colis: data.id_colis != null ? String(data.id_colis) : undefined,
      download_link: direct || fromHtml,
      raw: data,
    };
  });
}

/** GET /getposdetaille.php — parcel detail + status timeline. */
export async function calirexGetPosDetail(codeColis: string): Promise<CalirexColisDetail> {
  return withTokenRetry(async (token, baseUrl) => {
    const qs = new URLSearchParams({ token, codecolis: codeColis });
    const res = await fetch(`${baseUrl}/getposdetaille.php?${qs}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = await parseJsonSafe(res);
    if (data.error) throw new Error(asError(data, "Suivi colis introuvable."));
    return data as CalirexColisDetail;
  });
}

/** POST /get_pos_details_list.php — batch tracking by barcodes. */
export async function calirexGetPosDetailsList(
  codes: string[]
): Promise<Record<string, CalirexColisDetail>> {
  const list = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  if (list.length === 0) return {};

  return withTokenRetry(async (token, baseUrl) => {
    const res = await fetch(`${baseUrl}/get_pos_details_list.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TOKEN: token, POSBARCODE_LIST: list }),
      cache: "no-store",
    });
    const data = await parseJsonSafe(res);
    if (data.error) throw new Error(asError(data, "Sync Calirex échoué."));
    return data as Record<string, CalirexColisDetail>;
  });
}

/**
 * Map Calirex etat → local order status.
 * After shipping, commande status follows Calirex.
 */
export function mapCalirexEtatToOrderStatus(etat: string | null | undefined): string | null {
  if (!etat) return null;
  const e = etat
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Delivered
  if (
    e.includes("livre") ||
    e === "colis livre" ||
    e === "livres payes" ||
    e === "echange livree" ||
    e.includes("echange livr")
  ) {
    return "delivered";
  }

  // Return / cancel / claim → rejected
  if (
    e.includes("retour") ||
    e.includes("reclamation") ||
    e.includes("cloture") ||
    e.includes("annul")
  ) {
    return "rejected";
  }

  // Still in delivery pipeline
  if (
    e.includes("en cours") ||
    e.includes("enleve") ||
    e.includes("depot") ||
    e.includes("expedi") ||
    e.includes("attente") ||
    e.includes("a enlever") ||
    e.includes("probleme") ||
    e.includes("echange") ||
    e.includes("verification")
  ) {
    return "out_for_delivery";
  }

  // Unknown Calirex etat after ship → keep as out for delivery
  return "out_for_delivery";
}

/** Prefer latest timeline event, then colis.etat. */
export function pickCalirexEtat(detail: CalirexColisDetail | null | undefined): string | null {
  if (!detail) return null;
  const events = Array.isArray(detail.etat_colis) ? detail.etat_colis : [];
  if (events.length > 0) {
    const sorted = [...events].sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
    const latest = sorted[0]?.etat;
    if (typeof latest === "string" && latest.trim()) return latest.trim();
  }
  if (typeof detail.colis?.etat === "string" && detail.colis.etat.trim()) {
    return detail.colis.etat.trim();
  }
  return null;
}
