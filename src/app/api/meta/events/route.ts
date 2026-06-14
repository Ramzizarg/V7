import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sendMetaServerEvents, type MetaCustomData, type MetaUserDataInput } from "@/lib/metaConversionsApi";

type MetaEventPayload = {
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  customData?: MetaCustomData;
  userData?: Omit<MetaUserDataInput, "clientIpAddress" | "clientUserAgent">;
};

function clientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MetaEventPayload;
    const eventName = typeof body.eventName === "string" ? body.eventName.trim() : "";
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";

    if (!eventName || !eventId) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const result = await sendMetaServerEvents([
      {
        eventName,
        eventId,
        eventSourceUrl: typeof body.eventSourceUrl === "string" ? body.eventSourceUrl : undefined,
        customData: body.customData,
        userData: {
          ...body.userData,
          clientIpAddress: clientIp(req),
          clientUserAgent: req.headers.get("user-agent") ?? undefined,
        },
      },
    ]);

    if (result.skipped) {
      return NextResponse.json({ ok: true, mode: "pixel-only" });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Meta CAPI error." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, mode: "dual" });
  } catch (err) {
    console.error("[api/meta/events]", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
