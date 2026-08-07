import { NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { calirexGetToken } from "@/lib/calirex";

export const runtime = "nodejs";

/** Quick connectivity check for Calirex credentials. */
export async function GET() {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  try {
    const token = await calirexGetToken(true);
    return NextResponse.json({
      success: true,
      connected: true,
      tokenPreview: `${token.slice(0, 8)}…`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: err instanceof Error ? err.message : "Connexion Calirex échouée.",
      },
      { status: 500 }
    );
  }
}
