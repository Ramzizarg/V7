import { neon } from "@neondatabase/serverless";
import type { QueryResultRow } from "pg";

/** Neon / Postgres URL: primary env + common alternates; strips wrapping quotes from `.env`. */
export function resolveDatabaseUrl(): string | null {
  const raw =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim();
  if (!raw) return null;
  let s = raw;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s || null;
}

function getPool() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(connectionString);
}

export async function neonQuery<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const sql = getPool();
  const rows = (await sql.query(text, params)) as T[];
  return { rows };
}
