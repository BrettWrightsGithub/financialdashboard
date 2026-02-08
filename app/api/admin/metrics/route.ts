import { NextRequest, NextResponse } from "next/server";
import { getAdminMetrics } from "@/lib/adminMetrics";

export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch admin metrics" },
      { status: 500 }
    );
  }
}
