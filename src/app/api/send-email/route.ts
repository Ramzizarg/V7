import { NextRequest, NextResponse } from "next/server";
import { sendOrderEmails, type OrderEmailPayload } from "@/lib/sendOrderEmails";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OrderEmailPayload;

    if (!body.to || !body.fullName || !body.orderId) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
    }

    const result = await sendOrderEmails(body);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          adminError: result.adminError,
          clientError: result.clientError,
        },
        { status: result.error?.includes("RESEND_API_KEY") ? 503 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      adminId: result.adminId,
      clientId: result.clientId,
      adminEmailSent: result.adminSent,
      clientEmailSent: result.clientSent,
      emailWarning: result.error,
    });
  } catch (err) {
    console.error("[send-email] unexpected error:", err);
    return NextResponse.json(
      { error: "Erreur interne lors de l'envoi de l'email." },
      { status: 500 }
    );
  }
}
