import { NextRequest, NextResponse } from "next/server";
import { getAdminMetrics } from "@/lib/adminMetrics";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Failed to fetch admin metrics";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const windowDaysRaw = Number(searchParams.get("window_days") || "7");
    const windowDays = Number.isFinite(windowDaysRaw)
      ? Math.min(30, Math.max(1, Math.floor(windowDaysRaw)))
      : 7;

    const metrics = await getAdminMetrics(windowDays);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Admin metrics error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
