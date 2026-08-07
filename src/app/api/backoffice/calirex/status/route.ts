import { NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { calirexGetToken, isCalirexConfigured } from "@/lib/calirex";

export const runtime = "nodejs";

async function ensureToken(attempts = 3): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await calirexGetToken(i > 0);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Connexion Calirex échouée.");
}

/** Keep Calirex session warm — always reconnect automatically when configured. */
export async function GET() {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  if (!isCalirexConfigured()) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        connected: false,
        error: "CALIREX_LOGIN / CALIREX_PASSWORD manquants sur le serveur.",
      },
      { status: 503 }
    );
  }

  try {
    const token = await ensureToken(3);
    return NextResponse.json({
      success: true,
      configured: true,
      connected: true,
      tokenPreview: `${token.slice(0, 8)}…`,
    });
  } catch (err) {
    // Credentials exist — treat as configured; UI stays ready, ship will retry
    return NextResponse.json({
      success: false,
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : "Connexion Calirex temporairement indisponible.",
      retry: true,
    });
  }
}
