import { NextRequest, NextResponse } from "next/server";
import { getBatches } from "@/lib/categorization/retroactiveRules";

// GET - List batch operations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeUndone = searchParams.get("include_undone") === "true";
    const ruleId = searchParams.get("rule_id") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const batches = await getBatches({
      ruleId,
      includeUndone,
      limit,
    });

    return NextResponse.json({ batches });
  } catch (error) {
    console.error("Batch list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch batches" },
      { status: 500 }
    );
  }
}
