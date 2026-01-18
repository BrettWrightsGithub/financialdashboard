import { NextRequest, NextResponse } from "next/server";
import { triggerPlaidSync } from "@/lib/n8n/triggerSync";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account_id } = body;

    // Optional: Add auth check here (e.g., ensure user owns the account)

    const result = await triggerPlaidSync(account_id);

    if (!result.success && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 } // Bad Gateway (upstream error)
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Sync triggered successfully", 
      data: result 
    });

  } catch (error) {
    console.error("Error in sync trigger API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}