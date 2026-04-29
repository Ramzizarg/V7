import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

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

function shouldUseSsl(connectionString: string) {
  const lower = connectionString.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  if (/sslmode=disable/i.test(lower)) return false;
  return true;
}

function getPool() {
  if (!pool) {
    const connectionString = resolveDatabaseUrl();
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const ssl = shouldUseSsl(connectionString)
      ? { rejectUnauthorized: false as const }
      : undefined;
    pool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 15_000,
      ...(ssl ? { ssl } : {}),
    });
  }
  return pool;
}

export async function neonQuery<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const p = getPool();
  const result = await p.query<T>(text, params);
  return result;
}
