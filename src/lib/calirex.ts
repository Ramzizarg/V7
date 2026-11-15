/**
 * Calirex TN delivery API client
 * Docs: https://client.calirextn.com/Api/documentation.html
 *
 * Official endpoints (Base URL https://client.calirextn.com/Api/):
 * - POST/GET  /get_token              → { token }
 * - POST      /createcolis.php        → { code_colis }
 * - GET       /getbonlivraison.php    → { download_link | download_button_html }
 * - GET       /getposdetaille.php     → { colis, etat_colis }
 * - POST JSON /get_pos_details_list.php → { [barcode]: { colis, etat_colis } }
 *
 * Credentials: env (CALIREX_*) first, then Neon `app_settings`.
 * If the Api PHP layer returns empty 500s, fall back to the client portal.
 */

import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";

const DEFAULT_BASE = "https://client.calirextn.com/Api";
const PORTAL_ORIGIN = "https://client.calirextn.com";
const PORTAL_TOKEN = "portal-session";

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

/** Ensure base is `https://client.calirextn.com/Api` even if env/DB omitted `/Api`. */
export function normalizeCalirexBaseUrl(raw: string | null | undefined): string {
  let u = stripEnvQuotes(raw ?? "").trim().replace(/\/+$/, "");
  if (!u) return DEFAULT_BASE;

  u = u.replace(
    /\/(get_token|createcolis|getbonlivraison|getposdetaille|get_pos_details_list)(\.php)?$/i,
    ""
  );

  try {
    const parsed = new URL(u);
    if (/calirextn\.com$/i.test(parsed.hostname)) {
      let path = parsed.pathname.replace(/\/+$/, "") || "";
      if (!path || path === "/") {
        path = "/Api";
      } else if (!/\/Api$/i.test(path) && !/\/Api\//i.test(path)) {
        path = `${path}/Api`;
      }
      return `${parsed.origin}${path}`.replace(/\/+$/, "");
    }
  } catch {
    /* keep trimmed value */
  }

  return u || DEFAULT_BASE;
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
      baseUrl: normalizeCalirexBaseUrl(map.get("calirex_api_base") || DEFAULT_BASE),
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
      baseUrl: normalizeCalirexBaseUrl(envBase || DEFAULT_BASE),
    };
  }

  const db = await loadDbCredentials();
  const login = envLogin || db.login || "";
  const password = envPassword || db.password || "";
  const baseUrl = normalizeCalirexBaseUrl(envBase || db.baseUrl || DEFAULT_BASE);
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
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Réponse Calirex vide (${res.status}) sur ${res.url || "endpoint"}.`);
  }
  if (trimmed.startsWith("<") || /<!DOCTYPE/i.test(trimmed)) {
    throw new Error(
      `Réponse HTML Calirex (${res.status}) — URL API incorrecte ou endpoint indisponible (${res.url || "unknown"}).`
    );
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(`Réponse Calirex invalide (${res.status}): ${trimmed.slice(0, 200)}`);
  }
}

function asError(data: Record<string, unknown>, fallback: string) {
  const err = data.error ?? data.message ?? data.msg;
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

function rankTokenError(message: string): number {
  const m = message.toLowerCase();
  if (m.includes("identifiant") || m.includes("password") || m.includes("login")) return 3;
  if (m.includes("invalide") && !m.includes("html")) return 2;
  if (m.includes("vide") || m.includes("500")) return 2;
  if (m.includes("html") || m.includes("404")) return 0;
  return 1;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function calirexGetApiToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.value !== PORTAL_TOKEN && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const { login, password, baseUrl } = await resolveCalirexConfig();
  const form = new URLSearchParams({ login, password });
  const qs = new URLSearchParams({ login, password });

  // Docs order first (/get_token), then .php files that exist on the server.
  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: `${baseUrl}/get_token`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form,
      },
    },
    {
      url: `${baseUrl}/get_token?${qs}`,
      init: { method: "GET", headers: { Accept: "application/json" } },
    },
    {
      url: `${baseUrl}/get_token.php`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form,
      },
    },
    {
      url: `${baseUrl}/get_token.php?${qs}`,
      init: { method: "GET", headers: { Accept: "application/json" } },
    },
  ];

  let lastError = "Impossible d'obtenir le token Calirex.";
  let bestRank = -1;
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, { ...attempt.init, cache: "no-store" });
      const data = await parseJsonSafe(res);
      const token = typeof data.token === "string" ? data.token.trim() : "";
      if (token) {
        cachedToken = { value: token, expiresAt: Date.now() + 50 * 60 * 1000 };
        return token;
      }
      const msg = asError(data, lastError);
      const rank = rankTokenError(msg);
      if (rank >= bestRank) {
        bestRank = rank;
        lastError = msg;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : lastError;
      const rank = rankTokenError(msg);
      if (rank >= bestRank) {
        bestRank = rank;
        lastError = msg;
      }
    }
  }
  throw new Error(lastError);
}

/** Auth token — official API first, portal session fallback. */
export async function calirexGetToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  try {
    return await calirexGetApiToken(force);
  } catch {
    await ensurePortalSession(force);
    cachedToken = { value: PORTAL_TOKEN, expiresAt: Date.now() + 40 * 60 * 1000 };
    return PORTAL_TOKEN;
  }
}

type PortalVendorMeta = {
  LVP: string;
  entreprise: string;
  postalf: string;
  entreprisemylerz: string;
  prenomf: string;
  namef: string;
  telf: string;
  adressef: string;
  emailf: string;
  vendeur_id: string;
  jax_delegation: string;
  jax_gouvernorat: string;
};

type PortalSession = {
  cookie: string;
  expiresAt: number;
  vendor: PortalVendorMeta | null;
};

let portalSession: PortalSession | null = null;

function collectSetCookies(res: Response): string[] {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const list = anyHeaders.getSetCookie();
    if (list.length) return list;
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookieJar(jar: Map<string, string>, setCookies: string[]) {
  for (const c of setCookies) {
    const part = c.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

function cookieHeaderFromJar(jar: Map<string, string>) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function parseCookieHeader(header: string): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq > 0) jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return jar;
}

async function portalFetch(path: string, init: RequestInit = {}, session?: PortalSession) {
  const jar = parseCookieHeader(session?.cookie || portalSession?.cookie || "");
  const headers = new Headers(init.headers || {});
  if (jar.size) headers.set("Cookie", cookieHeaderFromJar(jar));
  const res = await fetch(`${PORTAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: "no-store",
    redirect: "follow",
  });
  mergeCookieJar(jar, collectSetCookies(res));
  const cookie = cookieHeaderFromJar(jar);
  if (portalSession) {
    portalSession = { ...portalSession, cookie };
  }
  return { res, text: await res.text(), cookie };
}

function extractHidden(html: string, id: string): string {
  const re = new RegExp(`id=['"]${id}['"][^>]*value=['"]([^'"]*)['"]`, "i");
  const re2 = new RegExp(`value=['"]([^'"]*)['"][^>]*id=['"]${id}['"]`, "i");
  return (html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "").trim();
}

async function loadPortalVendorMeta(session: PortalSession): Promise<PortalVendorMeta> {
  const { text, cookie } = await portalFetch("/jaxnAjouter_Colis.php", { method: "GET" }, session);
  const next: PortalSession = { ...session, cookie };
  portalSession = next;
  const vendor: PortalVendorMeta = {
    LVP: extractHidden(text, "LVP") || "NON",
    entreprise: extractHidden(text, "entreprise"),
    postalf: extractHidden(text, "postalf"),
    entreprisemylerz: extractHidden(text, "entreprisemylerz"),
    prenomf: extractHidden(text, "prenomf"),
    namef: extractHidden(text, "namef"),
    telf: extractHidden(text, "telf"),
    adressef: extractHidden(text, "adressef"),
    emailf: extractHidden(text, "emailf"),
    vendeur_id: extractHidden(text, "vendeur_id"),
    jax_delegation: extractHidden(text, "jax_delegation"),
    jax_gouvernorat: extractHidden(text, "jax_gouvernorat"),
  };
  if (!vendor.vendeur_id) {
    throw new Error("Impossible de lire le profil vendeur Calirex (portail).");
  }
  portalSession = { ...next, vendor, expiresAt: Date.now() + 40 * 60 * 1000 };
  return vendor;
}

async function ensurePortalSession(force = false): Promise<PortalSession> {
  if (!force && portalSession && portalSession.expiresAt > Date.now() && portalSession.cookie) {
    return portalSession;
  }

  const { login, password } = await resolveCalirexConfig();
  const jar = new Map<string, string>();
  const res = await fetch(`${PORTAL_ORIGIN}/loginconx.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: login, pwd: password }),
    cache: "no-store",
    redirect: "manual",
  });
  mergeCookieJar(jar, collectSetCookies(res));
  const body = (await res.text()).trim();
  if (body === "0") throw new Error("Compte Calirex introuvable (portail).");
  if (body === "-1") throw new Error("Mot de passe Calirex incorrect (portail).");
  if (body !== "1" || jar.size === 0) {
    throw new Error(`Connexion portail Calirex échouée (${res.status}: ${body.slice(0, 80)}).`);
  }

  portalSession = {
    cookie: cookieHeaderFromJar(jar),
    expiresAt: Date.now() + 40 * 60 * 1000,
    vendor: null,
  };
  return portalSession;
}

async function withTokenRetry<T>(fn: (token: string, baseUrl: string) => Promise<T>): Promise<T> {
  const cfg = await resolveCalirexConfig();
  const token = await calirexGetApiToken();
  try {
    return await fn(token, cfg.baseUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    if (msg.includes("token")) {
      const fresh = await calirexGetApiToken(true);
      return await fn(fresh, cfg.baseUrl);
    }
    throw e;
  }
}

async function withApiOrPortal<T>(apiFn: () => Promise<T>, portalFn: () => Promise<T>): Promise<T> {
  try {
    return await apiFn();
  } catch (apiErr) {
    try {
      return await portalFn();
    } catch (portalErr) {
      const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      const portalMsg = portalErr instanceof Error ? portalErr.message : String(portalErr);
      throw new Error(`${portalMsg} (API: ${apiMsg})`);
    }
  }
}

async function portalCreateColis(input: CalirexCreateColisInput): Promise<string> {
  const session = await ensurePortalSession();
  const vendor = session.vendor || (await loadPortalVendorMeta(session));

  const codeRes = await portalFetch(
    "/regenretecodecolis.php",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "" },
    portalSession || session
  );
  const codeColis = codeRes.text.trim();
  if (!/^CAL\d+/i.test(codeColis)) {
    throw new Error(`Code colis portail invalide: ${codeColis.slice(0, 80)}`);
  }

  const params = new URLSearchParams();
  params.set("LVP", vendor.LVP);
  params.set("entreprise", vendor.entreprise);
  params.set("postalf", vendor.postalf);
  params.set("entreprisemylerz", vendor.entreprisemylerz);
  params.set("prenomf", vendor.prenomf);
  params.set("namef", vendor.namef);
  params.set("telf", vendor.telf);
  params.set("adressef", vendor.adressef);
  params.set("emailf", vendor.emailf);
  params.set("vendeur_id", vendor.vendeur_id);
  params.set("code_colis", codeColis);
  params.set("prix", String(Math.round(Number(input.prix) || 0)));
  params.set("nb_pieces", String(Math.max(1, Math.floor(Number(input.nb_pieces) || 1))));
  params.set("designation", input.designation);
  params.set("poids", String(input.poids ?? 1));
  params.set("echange", input.echange ?? "non");
  params.set("type_colis", input.type_colis ?? "Colis Standard");
  params.set("fragile", input.fragile ?? "non");
  params.set("nom_client", input.nom_client);
  params.set("adresse_client", input.adresse_client);
  params.set("tel_client", input.tel_client);
  params.set("tel2_client", input.tel2_client ?? "");
  params.set("gouvernorat_client", input.gouvernorat_client);
  params.set(
    "delegation_client",
    input.delegation_client || input.localite_client || input.gouvernorat_client
  );
  params.set("codeClient", input.codeClient ?? "");
  params.set("jax_delegation", vendor.jax_delegation);
  params.set("jax_gouvernorat", vendor.jax_gouvernorat);
  params.set("commentaire_client", input.commentaire_client ?? "");
  params.set("date_livraison", input.date_livraison ?? "");
  params.set("horaire_livraison", input.horaire_livraison ?? "");
  params.set("typepaiement", "ESP");
  params.set("ouvcolis", String(input.ouvcolis ?? 1));

  const insert = await portalFetch(
    "/jaxninsert_colis.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    },
    portalSession || session
  );
  const colisId = Number.parseInt(insert.text.trim(), 10);
  if (!Number.isFinite(colisId)) {
    throw new Error(`Création colis portail échouée: ${insert.text.trim().slice(0, 200)}`);
  }

  // Best-effort barcode generation (same as portal UI)
  try {
    await portalFetch(
      "/tcpdf/examples/barcodes/jaxexample_1d_png.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id: String(colisId) }),
      },
      portalSession || session
    );
  } catch {
    /* optional */
  }

  return codeColis;
}

type PortalColisRow = {
  code: string;
  id: number;
  etat: string;
  download_link: string | null;
};

function tunisDateYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Tunis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function daysAgoTunis(days: number): string {
  const now = Date.now();
  return tunisDateYmd(new Date(now - days * 24 * 60 * 60 * 1000));
}

function parseListeColisRows(html: string): PortalColisRow[] {
  const rows: PortalColisRow[] = [];
  // Parse each <tr> in isolation — "en attente" rows have no jaxborderau PDF link,
  // so a cross-row regex would steal another colis id/etat (e.g. "Colis livré").
  const rowRe = /<tr\b[^>]*\bid=['"]row-(CAL\d+)['"][^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const code = m[1];
    const body = m[2];
    const idRaw =
      body.match(/details\((\d+)\)/i)?.[1] ||
      body.match(/modifierColisjax\((\d+)\)/i)?.[1] ||
      body.match(/jaxborderau\.php\?id=(\d+)/i)?.[1] ||
      "";
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id < 1) continue;

    const etat =
      body
        .match(/<span\b[^>]*class=['"][^'"]*badge[^'"]*['"][^>]*>\s*([^<]+?)\s*<\/span>/i)?.[1]
        ?.replace(/\s+/g, " ")
        .trim() || "en attente";

    const hasBon = /jaxborderau\.php\?id=/i.test(body);
    rows.push({
      code,
      id,
      etat,
      download_link: hasBon ? `${PORTAL_ORIGIN}/tcpdf/examples/jaxborderau.php?id=${id}` : null,
    });
  }
  return rows;
}

async function portalFetchListeColis(): Promise<PortalColisRow[]> {
  const session = await ensurePortalSession();
  const dateFin = tunisDateYmd();
  const dateDebut = daysAgoTunis(60);
  const qs = new URLSearchParams({
    etat: "",
    date_debut: dateDebut,
    date_fin: dateFin,
  });
  const { text } = await portalFetch(`/listecolis.php?${qs}`, { method: "GET" }, session);
  return parseListeColisRows(text);
}

async function portalLookupByCodes(codes: string[]): Promise<Map<string, PortalColisRow>> {
  const wanted = new Set(codes.map((c) => c.trim()).filter(Boolean));
  const map = new Map<string, PortalColisRow>();
  if (wanted.size === 0) return map;
  const rows = await portalFetchListeColis();
  for (const row of rows) {
    if (wanted.has(row.code)) map.set(row.code, row);
  }
  return map;
}

async function portalGetPosDetail(codeColis: string): Promise<CalirexColisDetail> {
  const hit = (await portalLookupByCodes([codeColis])).get(codeColis);
  if (!hit) throw new Error(`Colis ${codeColis} introuvable sur le portail Calirex.`);

  const session = await ensurePortalSession();
  const { text } = await portalFetch(`/detailscolis.php?id=${hit.id}`, { method: "GET" }, session);
  const events: CalirexEtatEvent[] = [];
  const rowRe =
    /<tr>\s*<td>\s*<strong>([^<]+)<\/strong>\s*<br>\s*<small[^>]*>\s*([^<]*)\s*<\/small>[\s\S]*?<span class="modal-badge[^"]*">\s*([^<]+?)\s*<\/span>[\s\S]*?<td>\s*([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text))) {
    const day = m[1].trim();
    const time = m[2].trim();
    const etat = m[3].replace(/\s+/g, " ").trim();
    const descHtml = m[4];
    const probleme =
      descHtml.match(/text-danger[\s\S]*?<\/i>\s*([^<]+)/i)?.[1]?.trim() ||
      descHtml.match(/text-danger[^>]*>\s*([^<]+)/i)?.[1]?.trim() ||
      "";
    const description = descHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    events.push({
      idcolis: hit.id,
      etat,
      date: `${day} ${time}`.trim(),
      description,
      PROBLEME: probleme,
    });
  }

  return {
    colis: {
      id: hit.id,
      code_colis: hit.code,
      etat: hit.etat || events[0]?.etat || "en attente",
    },
    etat_colis: events,
  };
}

async function portalGetPosDetailsList(
  codes: string[]
): Promise<Record<string, CalirexColisDetail>> {
  const lookup = await portalLookupByCodes(codes);
  const out: Record<string, CalirexColisDetail> = {};
  for (const code of codes) {
    const row = lookup.get(code);
    if (!row) continue;
    out[code] = {
      colis: { id: row.id, code_colis: row.code, etat: row.etat },
      etat_colis: [{ idcolis: row.id, etat: row.etat }],
    };
  }
  return out;
}

async function portalGetBonLivraison(codeColis: string): Promise<CalirexBonLivraison> {
  const hit = (await portalLookupByCodes([codeColis])).get(codeColis);
  if (!hit) throw new Error(`Bon de livraison introuvable pour ${codeColis}.`);
  return {
    id_colis: String(hit.id),
    download_link: hit.download_link,
  };
}

function extractHrefFromHtml(html: string | null | undefined): string | null {
  if (!html || typeof html !== "string") return null;
  const m = html.match(/href=['"]([^'"]+)['"]/i);
  if (!m?.[1]) return null;
  let href = m[1].replace(/\\\//g, "/");
  if (href.startsWith("//")) href = `https:${href}`;
  if (href.startsWith("/")) href = `${PORTAL_ORIGIN}${href}`;
  return href;
}

export type CalirexBonLivraison = {
  id_colis?: string;
  download_link: string | null;
  raw?: Record<string, unknown>;
};

/** POST /createcolis.php — create parcel, returns code_colis (CAL…). */
export async function calirexCreateColis(input: CalirexCreateColisInput): Promise<string> {
  return withApiOrPortal(
    async () =>
      withTokenRetry(async (token, baseUrl) => {
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
        params.set("ouvcolis", String(input.ouvcolis ?? 1));

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
      }),
    () => portalCreateColis(input)
  );
}

/** GET /getbonlivraison.php — delivery note / bordereau PDF link. */
export async function calirexGetBonLivraison(codeColis: string): Promise<CalirexBonLivraison> {
  return withApiOrPortal(
    async () =>
      withTokenRetry(async (token, baseUrl) => {
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
      }),
    () => portalGetBonLivraison(codeColis)
  );
}

/** GET /getposdetaille.php — parcel detail + status timeline. */
export async function calirexGetPosDetail(codeColis: string): Promise<CalirexColisDetail> {
  return withApiOrPortal(
    async () =>
      withTokenRetry(async (token, baseUrl) => {
        const qs = new URLSearchParams({ token, codecolis: codeColis });
        const res = await fetch(`${baseUrl}/getposdetaille.php?${qs}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await parseJsonSafe(res);
        if (data.error) throw new Error(asError(data, "Suivi colis introuvable."));
        return data as CalirexColisDetail;
      }),
    () => portalGetPosDetail(codeColis)
  );
}

/** POST /get_pos_details_list.php — batch tracking by barcodes. */
export async function calirexGetPosDetailsList(
  codes: string[]
): Promise<Record<string, CalirexColisDetail>> {
  const list = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  if (list.length === 0) return {};

  return withApiOrPortal(
    async () =>
      withTokenRetry(async (token, baseUrl) => {
        const res = await fetch(`${baseUrl}/get_pos_details_list.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ TOKEN: token, POSBARCODE_LIST: list }),
          cache: "no-store",
        });
        const data = await parseJsonSafe(res);
        if (data.error) throw new Error(asError(data, "Sync Calirex échoué."));
        return data as Record<string, CalirexColisDetail>;
      }),
    () => portalGetPosDetailsList(list)
  );
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

/**
 * Current status = `colis.etat` (docs). Timeline `etat_colis` is history only.
 */
export function pickCalirexEtat(detail: CalirexColisDetail | null | undefined): string | null {
  if (!detail) return null;
  if (typeof detail.colis?.etat === "string" && detail.colis.etat.trim()) {
    return detail.colis.etat.trim();
  }
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
  return null;
}
