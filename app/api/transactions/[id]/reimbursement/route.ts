import { NextRequest, NextResponse } from "next/server";
import { linkReimbursement, unlinkReimbursement } from "@/lib/categorization";

// POST - Link reimbursement to original expense
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reimbursementId } = await params;
    const body = await request.json();
    const { original_expense_id, copy_category = true } = body;

    if (!original_expense_id) {
      return NextResponse.json(
        { error: "original_expense_id is required" },
        { status: 400 }
      );
    }

    const result = await linkReimbursement(reimbursementId, original_expense_id, copy_category);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Link reimbursement error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to link reimbursement" },
      { status: 500 }
    );
  }
}

// DELETE - Unlink reimbursement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reimbursementId } = await params;

    const result = await unlinkReimbursement(reimbursementId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unlink reimbursement error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unlink reimbursement" },
      { status: 500 }
    );
  }
}
