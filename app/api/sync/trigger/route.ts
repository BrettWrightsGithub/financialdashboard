import { NextRequest, NextResponse } from "next/server";
import { triggerSync, getSyncSummary } from "@/lib/sync/plaidSync";

// POST - Trigger a manual sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { account_id, connection_id } = body;

    const result = await triggerSync({
      accountId: account_id,
      connectionId: connection_id,
    });

    if (!result.triggered) {
      return NextResponse.json(
        { error: result.error || "Failed to trigger sync" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sync triggered. Check status for updates.",
    });
  } catch (error) {
    console.error("Sync trigger error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger sync" },
      { status: 500 }
    );
  }
}

// GET - Get sync status summary
export async function GET() {
  try {
    const summary = await getSyncSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get sync status" },
      { status: 500 }
    );
  }
}
