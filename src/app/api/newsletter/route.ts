import { NextRequest, NextResponse } from "next/server";
import { sendMetaServerEvent } from "@/lib/metaConversionsApi";
import { templateNewsletterWelcome } from "@/lib/emailTemplates";
import { createMetaEventId } from "@/lib/metaPixel.shared";
import { getResend } from "@/lib/resendClient";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "VERO7 <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
  try {
    const resend = getResend();
    if (!resend) {
      return NextResponse.json(
        { error: "Configuration email manquante (RESEND_API_KEY)." },
        { status: 503 }
      );
    }

    const { email, name, metaEventId } = (await req.json()) as {
      email?: string;
      name?: string;
      metaEventId?: string;
    };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }

    const trimmedName = typeof name === "string" ? name.trim() : "";

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Bienvenue chez VERO7 — Votre code -10%",
      html: templateNewsletterWelcome(email, trimmedName || undefined),
    });

    if (error) {
      console.error("[Resend newsletter] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const leadEventId =
      typeof metaEventId === "string" && metaEventId.trim() ? metaEventId.trim() : createMetaEventId("lead");

    if (!metaEventId) {
      void sendMetaServerEvent({
        eventName: "Lead",
        eventId: leadEventId,
        eventSourceUrl: req.headers.get("referer") ?? undefined,
        userData: {
          email,
          fullName: trimmedName || undefined,
          country: "tn",
          clientIpAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
          clientUserAgent: req.headers.get("user-agent") ?? undefined,
        },
        customData: { currency: "TND" },
      });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("[newsletter] unexpected error:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
