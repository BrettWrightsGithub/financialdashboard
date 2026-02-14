import { NextRequest, NextResponse } from "next/server";
import { logTelemetryEvent } from "@/lib/telemetry";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventName = typeof body?.event_name === "string" ? body.event_name.trim() : "";
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : null;
    const pagePath = typeof body?.page_path === "string" ? body.page_path.trim() : null;
    const metadata =
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {};

    if (!eventName) {
      return NextResponse.json({ error: "event_name is required" }, { status: 400 });
    }

    await logTelemetryEvent({
      eventType: "client_behavior",
      eventName,
      route: "/api/telemetry/client-event",
      httpMethod: "POST",
      httpStatus: 202,
      sessionId,
      pagePath,
      userAgent: request.headers.get("user-agent"),
      metadata,
    });

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error("Client telemetry event error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to log client event" },
      { status: 500 }
    );
  }
}
