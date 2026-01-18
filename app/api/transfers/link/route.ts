import { NextRequest, NextResponse } from "next/server";
import { bulkLinkTransfers } from "@/lib/categorization";

/**
 * POST /api/transfers/link
 * 
 * Commits a list of detected transfer pairs to the database.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pairs } = body;

    if (!pairs || !Array.isArray(pairs)) {
      return NextResponse.json(
        { error: "Invalid request. 'pairs' must be an array of { outflowId, inflowId, confidence }" },
        { status: 400 }
      );
    }

    if (pairs.length === 0) {
      return NextResponse.json({
        success: true,
        linkedCount: 0
      });
    }

    const result = await bulkLinkTransfers(pairs);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Transfer linking error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Transfer linking failed",
        success: false 
      },
      { status: 500 }
    );
  }
}
