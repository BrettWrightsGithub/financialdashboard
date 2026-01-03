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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const sortBy = searchParams.get("sortBy") as "date" | "confidence" | "amount" | undefined;
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | undefined;
    const countOnly = searchParams.get("countOnly") === "true";
    const statsOnly = searchParams.get("statsOnly") === "true";

    if (countOnly) {
      const count = await getReviewQueueCount(month);
      return NextResponse.json({ count });
    }

    if (statsOnly) {
      const stats = await getReviewQueueStats(month);
      return NextResponse.json(stats);
    }

    const transactions = await getReviewQueueTransactions({
      month,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Review queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review queue" },
      { status: 500 }
    );
  }
}
