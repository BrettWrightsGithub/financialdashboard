import { NextRequest, NextResponse } from "next/server";
import { previewRuleApplication } from "@/lib/categorization/retroactiveRules";

// POST - Preview rule application
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule_id, date_range } = body;

    if (!rule_id) {
      return NextResponse.json(
        { error: "rule_id is required" },
        { status: 400 }
      );
    }

    const dateRange = date_range
      ? {
          start: new Date(date_range.start),
          end: new Date(date_range.end),
        }
      : undefined;

    const preview = await previewRuleApplication(rule_id, dateRange);

    if (!preview) {
      return NextResponse.json(
        { error: "Rule not found or preview failed" },
        { status: 404 }
      );
    }

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Rule preview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview rule" },
      { status: 500 }
    );
  }
}
