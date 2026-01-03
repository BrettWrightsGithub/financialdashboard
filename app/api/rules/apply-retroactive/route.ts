import { NextRequest, NextResponse } from "next/server";
import { applyRuleRetroactively } from "@/lib/categorization/retroactiveRules";

// POST - Apply rule retroactively
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule_id, transaction_ids, created_by = "user" } = body;

    if (!rule_id) {
      return NextResponse.json(
        { error: "rule_id is required" },
        { status: 400 }
      );
    }

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return NextResponse.json(
        { error: "transaction_ids array is required" },
        { status: 400 }
      );
    }

    const result = await applyRuleRetroactively(rule_id, transaction_ids, created_by);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to apply rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      batch_id: result.batchId,
      applied_count: result.appliedCount,
      skipped_locked: result.skippedLocked,
    });
  } catch (error) {
    console.error("Retroactive apply error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply rule" },
      { status: 500 }
    );
  }
}
