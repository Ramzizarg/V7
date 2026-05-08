import { NextResponse } from "next/server";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import type { QueryResultRow } from "pg";

export const runtime = "nodejs";

type Filter = { op: "eq" | "in"; column: string; value: unknown };

const ALLOWED_TABLES = new Set([
  "orders",
  "order_items",
  "products",
  "categories",
  "colors",
  "coupons",
  "home_content",
  "coming_soon_settings",
]);

function safeIdent(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
}

function parseColumns(select?: string) {
  if (!select || select.trim() === "*") return "*";
  const cols = select
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => safeIdent(c));
  return cols.join(", ");
}

function buildWhere(filters: Filter[] = [], params: unknown[]) {
  if (!filters.length) return "";
  const clauses: string[] = [];
  for (const f of filters) {
    const col = safeIdent(f.column);
    if (f.op === "eq") {
      params.push(f.value);
      clauses.push(`${col} = $${params.length}`);
      continue;
    }
    const arr = Array.isArray(f.value) ? f.value : [];
    if (arr.length === 0) {
      clauses.push("1 = 0");
      continue;
    }
    const placeholders = arr.map((v) => {
      params.push(v);
      return `$${params.length}`;
    });
    clauses.push(`${col} IN (${placeholders.join(",")})`);
  }
  return ` WHERE ${clauses.join(" AND ")}`;
}

const JSON_COLUMNS_BY_TABLE: Record<string, Set<string>> = {
  products: new Set(["images", "sizes", "measurement_table"]),
  home_content: new Set(["content"]),
};

function normalizeJsonColumnValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "") return null;
    try {
      return JSON.parse(t);
    } catch {
      throw new Error(
        `JSON invalide pour une colonne json/jsonb (extrait): ${t.slice(0, 160)}${t.length > 160 ? "…" : ""}`
      );
    }
  }
  return value;
}

function sanitizeJsonColumns(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const keys = JSON_COLUMNS_BY_TABLE[table];
  if (!keys) return row;
  const out = { ...row };
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(out, k)) {
      out[k] = normalizeJsonColumnValue(out[k]);
    }
  }
  return out;
}

/** Plain text or JSON string → value safe to JSON.stringify for a json/jsonb column */
function normalizeLooseJsonText(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const t = value.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

function sanitizeProductRow(row: Record<string, unknown>): Record<string, unknown> {
  let out = sanitizeJsonColumns("products", row);
  if (!Object.prototype.hasOwnProperty.call(out, "description")) return out;
  out = { ...out, description: normalizeLooseJsonText(out.description) };
  return out;
}

function usesJsonbCast(table: string, column: string): boolean {
  if (table === "home_content" && column === "content") return true;
  if (table !== "products") return false;
  return JSON_COLUMNS_BY_TABLE.products.has(column) || column === "description";
}

/** Bind as text containing valid JSON for `::jsonb` cast */
function toJsonbParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    const anyErr = error as Error & { code?: string; detail?: string; hint?: string };
    const bits = [anyErr.message, anyErr.detail, anyErr.hint, anyErr.code ? `code=${anyErr.code}` : ""].filter(
      Boolean
    );
    return bits.join(" — ");
  }
  return String(error);
}

function isMissingHomeContentTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const anyErr = error as Error & { code?: string };
  const msg = `${anyErr.message || ""}`.toLowerCase();
  return anyErr.code === "42P01" || (msg.includes("home_content") && msg.includes("does not exist"));
}

async function ensureHomeContentTable(): Promise<void> {
  await neonQuery(`
    CREATE TABLE IF NOT EXISTS home_content (
      id text PRIMARY KEY,
      content jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function neonQueryWithHomeContentRecovery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  table?: string
) {
  try {
    return await neonQuery<T>(sql, params);
  } catch (error) {
    if (table === "home_content" && isMissingHomeContentTableError(error)) {
      await ensureHomeContentTable();
      return await neonQuery<T>(sql, params);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json(
        {
          data: null,
          error:
            "DATABASE_URL manquant. Ajoutez la chaine Neon dans .env.local puis redemarrez le serveur (npm run dev).",
        },
        { status: 503 }
      );
    }

    const body = (await req.json()) as any;
    const table = String(body.table || "");
    const action = String(body.action || "select");

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ data: null, error: `Table not allowed: ${table}` }, { status: 400 });
    }

    const tableIdent = safeIdent(table);

    if (action === "select") {
      const params: unknown[] = [];
      const cols = parseColumns(body.select);
      const where = buildWhere(body.filters || [], params);
      const order = body.orderBy ? ` ORDER BY ${safeIdent(String(body.orderBy))} ${body.ascending === false ? "DESC" : "ASC"}` : "";
      const limit = Number.isFinite(body.limit) ? ` LIMIT ${Math.max(1, Number(body.limit))}` : "";
      const { rows } = await neonQueryWithHomeContentRecovery(
        `SELECT ${cols} FROM ${tableIdent}${where}${order}${limit}`,
        params,
        table
      );

      let count: number | null = null;
      if (body.count === "exact") {
        const c = await neonQueryWithHomeContentRecovery<{ total: string }>(
          `SELECT COUNT(*)::text as total FROM ${tableIdent}${where}`,
          params,
          table
        );
        count = Number(c.rows?.[0]?.total || 0);
      }

      return NextResponse.json({ data: body.head ? null : rows, error: null, count });
    }

    if (action === "insert") {
      const values = Array.isArray(body.values) ? body.values : [body.values];
      if (!values.length) return NextResponse.json({ data: [], error: null });
      const inserted = [];
      for (const row of values) {
        const raw = (row || {}) as Record<string, unknown>;
        const safeRow =
          table === "products" ? sanitizeProductRow(raw) : sanitizeJsonColumns(table, raw);
        const keys = Object.keys(safeRow);
        if (!keys.length) continue;
        const cols = keys.map((k) => safeIdent(k)).join(", ");
        const params = keys.map((k) => {
          const v = safeRow[k];
          return usesJsonbCast(table, k) ? toJsonbParam(v) : v;
        });
        const ph = keys
          .map((k, i) => {
            const n = i + 1;
            return usesJsonbCast(table, k) ? `$${n}::jsonb` : `$${n}`;
          })
          .join(", ");
        const res = await neonQueryWithHomeContentRecovery(
          `INSERT INTO ${tableIdent} (${cols}) VALUES (${ph}) RETURNING *`,
          params,
          table
        );
        inserted.push(...res.rows);
      }
      return NextResponse.json({ data: inserted, error: null });
    }

    if (action === "upsert") {
      const raw = (body.values || {}) as Record<string, unknown>;
      const row = table === "products" ? sanitizeProductRow(raw) : sanitizeJsonColumns(table, raw);
      const conflict = String(body.onConflict || "id");
      const keys = Object.keys(row);
      if (!keys.length) return NextResponse.json({ data: null, error: "No values" }, { status: 400 });
      const cols = keys.map((k) => safeIdent(k)).join(", ");
      const params = keys.map((k) => {
        const v = row[k];
        return usesJsonbCast(table, k) ? toJsonbParam(v) : v;
      });
      const placeholders = keys
        .map((k, i) => {
          const n = i + 1;
          return usesJsonbCast(table, k) ? `$${n}::jsonb` : `$${n}`;
        })
        .join(", ");
      const updateCols = keys.filter((k) => k !== conflict).map((k) => `${safeIdent(k)} = EXCLUDED.${safeIdent(k)}`).join(", ");
      const sql = `INSERT INTO ${tableIdent} (${cols}) VALUES (${placeholders}) ON CONFLICT (${safeIdent(conflict)}) DO UPDATE SET ${updateCols} RETURNING *`;
      const { rows } = await neonQueryWithHomeContentRecovery(sql, params, table);
      return NextResponse.json({ data: rows[0] ?? null, error: null });
    }

    if (action === "update") {
      const raw = (body.values || {}) as Record<string, unknown>;
      const updates = table === "products" ? sanitizeProductRow(raw) : sanitizeJsonColumns(table, raw);
      const keys = Object.keys(updates);
      if (!keys.length) return NextResponse.json({ data: null, error: "No values" }, { status: 400 });
      const params: unknown[] = [];
      const setSql = keys
        .map((k) => {
          const v = updates[k];
          const val = usesJsonbCast(table, k) ? toJsonbParam(v) : v;
          params.push(val);
          const n = params.length;
          return usesJsonbCast(table, k) ? `${safeIdent(k)} = $${n}::jsonb` : `${safeIdent(k)} = $${n}`;
        })
        .join(", ");
      const where = buildWhere(body.filters || [], params);
      const { rows } = await neonQueryWithHomeContentRecovery(
        `UPDATE ${tableIdent} SET ${setSql}${where} RETURNING *`,
        params,
        table
      );
      return NextResponse.json({ data: rows, error: null });
    }

    if (action === "delete") {
      const params: unknown[] = [];
      const where = buildWhere(body.filters || [], params);
      const { rows } = await neonQueryWithHomeContentRecovery(
        `DELETE FROM ${tableIdent}${where} RETURNING *`,
        params,
        table
      );
      return NextResponse.json({ data: rows, error: null });
    }

    return NextResponse.json({ data: null, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = serializeError(error);
    if (process.env.NODE_ENV === "development") {
      console.error("[api/neon/table]", message);
    }
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
