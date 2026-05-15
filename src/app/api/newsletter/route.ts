import { NextRequest, NextResponse } from "next/server";
import { templateNewsletterWelcome } from "@/lib/emailTemplates";
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

    const { email } = (await req.json()) as { email?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Bienvenue chez VERO7 — Votre code -10%",
      html: templateNewsletterWelcome(email),
    });

    if (error) {
      console.error("[Resend newsletter] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("[newsletter] unexpected error:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
