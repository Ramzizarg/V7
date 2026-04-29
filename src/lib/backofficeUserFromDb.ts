import { verifyPasswordStoredHash } from "@/lib/backofficeAuth";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";

export type BackofficeDbLoginResult = "ok" | "fail" | "skip";

/**
 * If `backoffice_users` has a row for this email, password must match that row (DB wins).
 * If no row, returns `skip` so caller can fall back to env credentials.
 * On DB errors (e.g. table not created yet), returns `skip`.
 */
export async function tryBackofficeDbLogin(
  email: string,
  password: string
): Promise<BackofficeDbLoginResult> {
  if (!resolveDatabaseUrl()) return "skip";
  const normalized = email.trim();
  if (!normalized) return "skip";

  try {
    const { rows } = await neonQuery<{ password_hash: string }>(
      `SELECT password_hash::text AS password_hash
       FROM backoffice_users
       WHERE lower(trim(email)) = lower(trim($1))
       LIMIT 1`,
      [normalized]
    );
    const row = rows?.[0];
    if (!row?.password_hash?.trim()) return "skip";

    const ok = await verifyPasswordStoredHash(password, row.password_hash);
    return ok ? "ok" : "fail";
  } catch {
    return "skip";
  }
}
