import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// POST - Toggle transfer status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();
    const { is_transfer } = body;

    if (typeof is_transfer !== "boolean") {
      return NextResponse.json(
        { error: "is_transfer (boolean) is required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("transactions")
      .update({
        is_transfer,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to update: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: data,
    });
  } catch (error) {
    console.error("Transfer toggle error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to toggle transfer" },
      { status: 500 }
    );
  }
}
