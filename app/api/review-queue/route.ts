/**
 * API Route: Review Queue
 * GET: Fetch transactions needing review with optional filters
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getReviewQueueTransactions,
  getReviewQueueCount,
  getReviewQueueStats,
} from "@/lib/categorization/reviewQueue";
import { logTelemetryEvent } from "@/lib/telemetry";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const track = async (status: number, metadata?: Record<string, unknown>) => {
    await logTelemetryEvent({
      eventType: "api_call",
      eventName: "review_queue_get",
      route: "/api/review-queue",
      httpMethod: "GET",
      httpStatus: status,
      latencyMs: Date.now() - startedAt,
      userAgent: request.headers.get("user-agent"),
      metadata: metadata || {},
    });
  };

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const sortBy = searchParams.get("sortBy") as "date" | "confidence" | "amount" | undefined;
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | undefined;
    const countOnly = searchParams.get("countOnly") === "true";
    const statsOnly = searchParams.get("statsOnly") === "true";

    if (countOnly) {
      const count = await getReviewQueueCount(month);
      await track(200, { mode: "count_only", count });
      return NextResponse.json({ count });
    }

    if (statsOnly) {
      const stats = await getReviewQueueStats(month);
      await track(200, { mode: "stats_only" });
      return NextResponse.json(stats);
    }

    const transactions = await getReviewQueueTransactions({
      month,
      sortBy,
      sortOrder,
    });

    await track(200, { mode: "full", count: transactions.length });
    return NextResponse.json({
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Review queue error:", error);
    await track(500, { reason: "exception" });
    return NextResponse.json(
      { error: "Failed to fetch review queue" },
      { status: 500 }
    );
  }
}
