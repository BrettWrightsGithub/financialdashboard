import { NextRequest, NextResponse } from "next/server";
import { getAuditHistory } from "@/lib/categorization/auditLog";

// GET - Fetch audit history for a transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const history = await getAuditHistory(transactionId);

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Audit history error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch audit history" },
      { status: 500 }
    );
  }
}
