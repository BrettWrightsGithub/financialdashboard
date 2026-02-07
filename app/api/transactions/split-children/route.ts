import { NextRequest, NextResponse } from "next/server";
import { deleteSplitChild } from "@/lib/categorization/transactionSplitting";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const childId = body.child_id;

    if (!childId || typeof childId !== "string") {
      return NextResponse.json({ error: "child_id is required" }, { status: 400 });
    }

    const result = await deleteSplitChild(childId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to delete split child" }, { status: 400 });
    }

    return NextResponse.json({ success: true, parent_id: result.parentId });
  } catch (error) {
    console.error("Split child delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete split child" },
      { status: 500 }
    );
  }
}
