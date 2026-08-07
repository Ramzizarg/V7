import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  BACKOFFICE_SESSION_COOKIE,
  verifyBackofficeSessionToken,
} from "@/lib/backofficeAuth";

export async function requireBackofficeSession(): Promise<NextResponse | null> {
  const jar = await cookies();
  const token = jar.get(BACKOFFICE_SESSION_COOKIE)?.value;
  if (!(await verifyBackofficeSessionToken(token))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  return null;
}
