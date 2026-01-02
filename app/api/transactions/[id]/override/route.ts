import { NextRequest, NextResponse } from "next/server";
import { applyUserOverride, lockTransactionCategory, unlockTransactionCategory } from "@/lib/categorization";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();
    const { category_id, learn_payee = true } = body;

    if (!category_id) {
      return NextResponse.json(
        { error: "category_id is required" },
        { status: 400 }
      );
    }

    const result = await applyUserOverride(transactionId, category_id, learn_payee);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to apply override" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      old_category_id: result.oldCategoryId,
      new_category_id: result.newCategoryId,
      payee_learned: result.payeeLearned,
    });
  } catch (error) {
    console.error("Override error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Override failed" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();
    const { locked } = body;

    if (typeof locked !== "boolean") {
      return NextResponse.json(
        { error: "locked (boolean) is required" },
        { status: 400 }
      );
    }

    const success = locked
      ? await lockTransactionCategory(transactionId)
      : await unlockTransactionCategory(transactionId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update lock status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, locked });
  } catch (error) {
    console.error("Lock error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lock update failed" },
      { status: 500 }
    );
  }
}
