import { NextResponse } from "next/server";
import { withApiNoStoreHeaders } from "@/lib/apiResponse";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { parseProductActive } from "@/lib/productListing";
import type { Product, StorefrontCategory } from "@/lib/types";

/** Neon (PostgreSQL via `DATABASE_URL`): `products` + `categories` for storefront. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const CATEGORY_COVER_FALLBACKS = ["/V7/2.jpeg", "/V7/3.jpeg", "/V7/4.jpeg", "/V7/1.jpg", "/V7/img-1.jpg"] as const;

function attachCategoryCovers(
  products: Product[],
  rows: { id: number; name: string; slug: string | null; sort_order?: number | null }[]
): StorefrontCategory[] {
  const firstImageByCat = new Map<number, string>();
  for (const p of products) {
    if (p.category_id == null) continue;
    if (firstImageByCat.has(p.category_id)) continue;
    const img = p.images[0];
    if (img) firstImageByCat.set(p.category_id, img);
  }
  return rows.map((c, i) => ({
    id: num(c.id),
    name: String(c.name),
    slug: (c.slug && c.slug.trim()) || `categorie-${c.id}`,
    sort_order: c.sort_order ?? null,
    image: firstImageByCat.get(num(c.id)) ?? CATEGORY_COVER_FALLBACKS[i % CATEGORY_COVER_FALLBACKS.length],
  }));
}

async function fetchCategoryRows(): Promise<{ id: number; name: string; slug: string | null; sort_order?: number | null }[]> {
  try {
    const { rows } = await neonQuery<{ id: number; name: string; slug: string | null; sort_order: number | null }>(
      `SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order NULLS LAST, name`
    );
    return rows ?? [];
  } catch {
    try {
      const { rows } = await neonQuery<{ id: number; name: string; slug: string | null }>(
        `SELECT id, name, slug FROM categories ORDER BY name`
      );
      return (rows ?? []).map((r) => ({ ...r, sort_order: null as number | null }));
    } catch {
      return [];
    }
  }
}

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
  sizes?: unknown;
  color?: string | null;
  color_id?: unknown;
  color_hex?: string | null;
  color_2?: string | null;
  color_id_2?: unknown;
  color_2_hex?: string | null;
  active?: unknown;
};

function rowToProduct(r: DbRow & { category_name?: string | null }): Product {
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
    color: r.color != null ? String(r.color) : null,
    color_id: r.color_id != null ? num(r.color_id) : null,
    color_hex: r.color_hex != null ? String(r.color_hex) : null,
    color_2: r.color_2 != null ? String(r.color_2) : null,
    color_2_id: r.color_id_2 != null ? num(r.color_id_2) : null,
    color_2_hex: r.color_2_hex != null ? String(r.color_2_hex) : null,
    active: parseProductActive(r.active),
  };
}

async function fetchProductRows(): Promise<(DbRow & { category_name: string | null })[]> {
  const productCols = await getTableColumns("products");
  const categoryCols = await getTableColumns("categories");
  const colorCols = await getTableColumns("colors");
  if (productCols.size === 0) return [];

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

  const orderSql = productCols.has("created_at")
    ? "p.created_at DESC NULLS LAST, p.id DESC"
    : productCols.has("id")
      ? "p.id DESC"
      : "p.name ASC";

  const sql = `SELECT ${selectSql}
               FROM products p${joinSql}
               ORDER BY ${orderSql}
               LIMIT 48`;

  const { rows } = await neonQuery<DbRow & { category_name: string | null }>(sql);
  return (rows ?? []) as (DbRow & { category_name: string | null })[];
}

function serializeJson(body: unknown) {
  return JSON.stringify(body, (_key, value) => (typeof value === "bigint" ? Number(value) : value));
}

function errMessage(e: unknown): string {
  if (e instanceof Error) {
    const any = e as Error & { code?: string };
    return [any.message, any.code ? `(${any.code})` : ""].filter(Boolean).join(" ");
  }
  return String(e);
}

export async function GET() {
  if (!resolveDatabaseUrl()) {
    return withApiNoStoreHeaders(
      new NextResponse(
        serializeJson({
          products: [],
          categories: [],
          error:
            "DATABASE_URL (ou POSTGRES_URL) manquant. Ajoutez-le dans .env.local puis redemarrez npm run dev.",
        }),
        { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
      )
    );
  }

  try {
    const withCategory = await fetchProductRows();
    const products: Product[] = withCategory.map((r) => rowToProduct(r));

    let categories: StorefrontCategory[] = [];
    try {
      const catRows = await fetchCategoryRows();
      if (catRows.length > 0) {
        categories = attachCategoryCovers(products, catRows);
      }
    } catch (catErr) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[api/products] categories load failed:", catErr);
      }
      categories = [];
    }

    const payload = { products, categories };
    return withApiNoStoreHeaders(
      new NextResponse(serializeJson(payload), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    );
  } catch (e) {
    const message = errMessage(e);
    if (process.env.NODE_ENV === "development") {
      console.error("[api/products]", message, e);
    }
    return withApiNoStoreHeaders(
      new NextResponse(
        serializeJson({
          products: [],
          categories: [],
          error:
            process.env.NODE_ENV === "development"
              ? message
              : "Impossible de lire les produits. Verifiez la connexion Neon et le schema des tables.",
        }),
        { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
      )
    );
  }
}
