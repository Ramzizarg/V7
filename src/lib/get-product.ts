import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { parseProductActive } from "@/lib/productListing";
import { slugifyProductName } from "@/lib/productUrl";
import type { Product } from "@/lib/types";

function parseImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  if (typeof raw === "string") {
    const t = raw.trim();
    // Handle Postgres array literal format: {"a","b"}.
    if (t.startsWith("{") && t.endsWith("}")) {
      const inner = t.slice(1, -1).trim();
      if (!inner) return [];
      const parts = inner
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((s) => s.trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"'))
        .filter((s) => s.length > 0);
      if (parts.length > 0) return parts;
    }
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      if (t) return [t];
    }
  }
  return [];
}

function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeDescription(d: unknown): string | null {
  if (d == null) return null;
  if (typeof d === "string") {
    let out = d;
    const t = out.trim();
    if (t.startsWith('"') && t.endsWith('"')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (typeof parsed === "string") out = parsed;
      } catch {
        // Keep original value when it is not JSON-encoded.
      }
    }
    if (!out.includes("\n") && out.includes("\\n")) {
      out = out.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
    }
    return out;
  }
  if (typeof d === "object") {
    try {
      return JSON.stringify(d);
    } catch {
      return null;
    }
  }
  return String(d);
}

function parseSizes(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) {
        return j.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

type DbRow = {
  id: unknown;
  name: string;
  slug: string | null;
  description: unknown;
  price: unknown;
  stock: unknown;
  category_id: number | null;
  images: unknown;
  discount_price: unknown;
  created_at: unknown;
  category_name: string | null;
  sizes?: unknown;
  size_guide_image?: string | null;
  measurement_table?: unknown;
  color?: string | null;
  color_id?: unknown;
  color_hex?: string | null;
  color_2?: string | null;
  color_id_2?: unknown;
  color_2_hex?: string | null;
  active?: unknown;
};

async function getTableColumns(tableName: string): Promise<Set<string>> {
  try {
    const { rows } = await neonQuery<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = $1`,
      [tableName]
    );
    return new Set((rows ?? []).map((r) => String(r.column_name)));
  } catch {
    return new Set<string>();
  }
}

function rowToProduct(r: DbRow): Product {
  const created =
    r.created_at instanceof Date
      ? r.created_at.toISOString()
      : typeof r.created_at === "string"
        ? r.created_at
        : new Date().toISOString();
  return {
    id: num(r.id),
    name: String(r.name ?? ""),
    slug: r.slug ? String(r.slug) : undefined,
    description: normalizeDescription(r.description),
    price: num(r.price),
    stock: num(r.stock),
    category_id: r.category_id != null ? num(r.category_id) : null,
    category_name: r.category_name != null ? String(r.category_name) : null,
    images: parseImages(r.images),
    created_at: created,
    discount_price: r.discount_price != null && r.discount_price !== "" ? num(r.discount_price) : null,
    sizes: parseSizes(r.sizes),
    size_guide_image: r.size_guide_image != null ? String(r.size_guide_image) : null,
    measurement_table:
      r.measurement_table == null
        ? null
        : typeof r.measurement_table === "string"
          ? r.measurement_table
          : (() => {
              try {
                return JSON.stringify(r.measurement_table);
              } catch {
                return null;
              }
            })(),
    color: r.color != null ? String(r.color) : null,
    color_id: r.color_id != null ? num(r.color_id) : null,
    color_hex: r.color_hex != null ? String(r.color_hex) : null,
    color_2: r.color_2 != null ? String(r.color_2) : null,
    color_2_id: r.color_id_2 != null ? num(r.color_id_2) : null,
    color_2_hex: r.color_2_hex != null ? String(r.color_2_hex) : null,
    active: parseProductActive(r.active),
  };
}

async function fetchOne(whereSql: string, params: unknown[]): Promise<Product | null> {
  const productCols = await getTableColumns("products");
  const categoryCols = await getTableColumns("categories");
  const colorCols = await getTableColumns("colors");
  if (productCols.size === 0) return null;

  const pExpr = (col: string, fallbackSql: string) =>
    productCols.has(col) ? `p.${col}` : `${fallbackSql} AS ${col}`;

  const canJoinCategories =
    productCols.has("category_id") && categoryCols.has("id") && categoryCols.has("name");
  const canJoinColors =
    productCols.has("color_id") && colorCols.has("id") && colorCols.has("name");
  const canJoinColors2 =
    productCols.has("color_id_2") && colorCols.has("id") && colorCols.has("name");
  const productColorExpr = productCols.has("color") ? "NULLIF(TRIM(p.color), '')" : "NULL::text";
  const colorExpr = canJoinColors
    ? `COALESCE(NULLIF(TRIM(clr.name), ''), ${productColorExpr}) AS color`
    : `${productColorExpr} AS color`;
  const color2Expr = canJoinColors2
    ? "NULLIF(TRIM(clr2.name), '') AS color_2"
    : "NULL::text AS color_2";

  const selectSql = [
    pExpr("id", "0::int"),
    pExpr("name", "''::text"),
    pExpr("slug", "NULL::text"),
    pExpr("description", "NULL::text"),
    pExpr("price", "0::numeric"),
    pExpr("stock", "0::int"),
    pExpr("category_id", "NULL::int"),
    pExpr("images", "'[]'::jsonb"),
    pExpr("discount_price", "NULL::numeric"),
    pExpr("created_at", "NOW()"),
    canJoinCategories ? "c.name AS category_name" : "NULL::text AS category_name",
    pExpr("sizes", "NULL::jsonb"),
    pExpr("size_guide_image", "NULL::text"),
    pExpr("measurement_table", "NULL::jsonb"),
    pExpr("color_id", "NULL::int"),
    pExpr("color_id_2", "NULL::int"),
    pExpr("active", "true::boolean"),
    colorExpr,
    canJoinColors && colorCols.has("hex") ? "clr.hex AS color_hex" : "NULL::text AS color_hex",
    color2Expr,
    canJoinColors2 && colorCols.has("hex") ? "clr2.hex AS color_2_hex" : "NULL::text AS color_2_hex",
  ].join(", ");

  const categoryJoinSql = canJoinCategories ? " LEFT JOIN categories c ON c.id = p.category_id" : "";
  const colorJoinSql = canJoinColors ? " LEFT JOIN colors clr ON clr.id = p.color_id" : "";
  const color2JoinSql = canJoinColors2 ? " LEFT JOIN colors clr2 ON clr2.id = p.color_id_2" : "";
  const joinSql = `${categoryJoinSql}${colorJoinSql}${color2JoinSql}`;
  const { rows } = await neonQuery<DbRow>(`SELECT ${selectSql} FROM products p${joinSql} ${whereSql}`, params);
  const r = rows?.[0];
  return r ? rowToProduct(r) : null;
}

/**
 * Charge un produit pour la fiche `/collection/[slug]`.
 * Correspondance : `id-{id}` (legacy), slug DB, puis slug calculé depuis `name`.
 */
export async function getProductBySlug(rawSlug: string): Promise<Product | null> {
  if (!resolveDatabaseUrl()) return null;
  const slug = decodeURIComponent(rawSlug).trim();
  if (!slug) return null;
  const productCols = await getTableColumns("products");

  const idFromPrefix = /^id-(\d+)$/.exec(slug);
  if (idFromPrefix) {
    const id = Number(idFromPrefix[1]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return fetchOne(`WHERE p.id = $1 LIMIT 1`, [id]);
  }

  if (productCols.has("slug")) {
    const bySlug = await fetchOne(
      `WHERE TRIM(COALESCE(p.slug, '')) <> '' AND LOWER(TRIM(p.slug)) = LOWER(TRIM($1)) LIMIT 1`,
      [slug]
    );
    if (bySlug) return bySlug;
  }

  if (productCols.has("name")) {
    const { rows } = await neonQuery<{ id: unknown; name: string | null }>(
      `SELECT p.id, p.name
       FROM products p
       WHERE TRIM(COALESCE(p.name, '')) <> ''
       LIMIT 2000`
    );
    const candidate = rows.find((row) => slugifyProductName(row.name) === slug);
    if (candidate) {
      const id = Number(candidate.id);
      if (Number.isFinite(id) && id > 0) {
        const byNameSlug = await fetchOne(`WHERE p.id = $1 LIMIT 1`, [id]);
        if (byNameSlug) return byNameSlug;
      }
    }
  }

  // Defensive fallback when column introspection is stale/partial:
  // try matching against product names directly without relying on productCols.
  try {
    const { rows } = await neonQuery<{ id: unknown; name: string | null }>(
      `SELECT p.id, p.name
       FROM products p
       WHERE p.name IS NOT NULL
       LIMIT 5000`
    );
    const byFallbackName = rows.find((row) => slugifyProductName(row.name) === slug);
    if (byFallbackName) {
      const id = Number(byFallbackName.id);
      if (Number.isFinite(id) && id > 0) {
        const byNameSlug = await fetchOne(`WHERE p.id = $1 LIMIT 1`, [id]);
        if (byNameSlug) return byNameSlug;
      }
    }
  } catch {
    // ignore and continue with legacy numeric fallback
  }

  if (/^\d+$/.test(slug)) {
    const id = Number(slug);
    if (Number.isFinite(id) && id > 0) {
      const byId = await fetchOne(`WHERE p.id = $1 LIMIT 1`, [id]);
      if (byId) return byId;
    }
  }

  return null;
}
