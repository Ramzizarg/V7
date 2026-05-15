import { Resend } from "resend";

/** Avoid `new Resend()` at module load (build/CI often has no key). */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}
