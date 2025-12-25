import { NextResponse } from "next/server";
import { runHealthCheck } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Returns health status of all API connections
 * Use this endpoint for periodic monitoring
 */
export async function GET() {
  try {
    const report = await runHealthCheck();
    
    const statusCode = report.overall === "healthy" ? 200 : 
                       report.overall === "degraded" ? 207 : 503;

    return NextResponse.json(report, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        overall: "unhealthy",
        checks: [],
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 503 }
    );
  }
}
