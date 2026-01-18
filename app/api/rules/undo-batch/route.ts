import { NextRequest, NextResponse } from "next/server";
import { undoBatch } from "@/lib/categorization/retroactiveRules";

// POST - Undo a batch operation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_id } = body;

    if (!batch_id) {
      return NextResponse.json(
        { error: "batch_id is required" },
        { status: 400 }
      );
    }

    const result = await undoBatch(batch_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to undo batch" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transactions_reverted: result.transactionsReverted,
    });
  } catch (error) {
    console.error("Undo batch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to undo batch" },
      { status: 500 }
    );
  }
}
