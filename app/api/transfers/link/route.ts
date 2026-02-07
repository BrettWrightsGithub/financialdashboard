import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

async function upsertLink(supabase: ReturnType<typeof createServerSupabaseClient>, transactionId: string, counterpartId: string | null) {
  const payload: Record<string, unknown> = {
    transfer_pair_id: counterpartId,
    is_transfer: counterpartId ? true : false,
    transfer_match_source: counterpartId ? "manual" : null,
    transfer_match_confidence: counterpartId ? 1.0 : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("transactions").update(payload).eq("id", transactionId);
  return error;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction_id, counterpart_id } = body;

    if (!transaction_id || !counterpart_id) {
      return NextResponse.json(
        { error: "transaction_id and counterpart_id are required" },
        { status: 400 }
      );
    }

    if (transaction_id === counterpart_id) {
      return NextResponse.json(
        { error: "A transaction cannot be linked to itself" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const errA = await upsertLink(supabase, transaction_id, counterpart_id);
    const errB = await upsertLink(supabase, counterpart_id, transaction_id);

    if (errA || errB) {
      return NextResponse.json(
        { error: errA?.message || errB?.message || "Failed to link transfer pair" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction_id,
      counterpart_id,
      linked: true,
    });
  } catch (error) {
    console.error("Transfer link error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to link transfer" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const transactionId = body.transaction_id || new URL(request.url).searchParams.get("transaction_id");

    if (!transactionId) {
      return NextResponse.json({ error: "transaction_id is required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("id, transfer_pair_id")
      .eq("id", transactionId)
      .single();

    if (txError || !tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const counterpartId = tx.transfer_pair_id as string | null;
    const errA = await upsertLink(supabase, transactionId, null);
    let errB: { message?: string } | null = null;

    if (counterpartId) {
      errB = await upsertLink(supabase, counterpartId, null);
    }

    if (errA || errB) {
      return NextResponse.json(
        { error: errA?.message || errB?.message || "Failed to unlink transfer" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      counterpart_id: counterpartId,
      linked: false,
    });
  } catch (error) {
    console.error("Transfer unlink error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unlink transfer" },
      { status: 500 }
    );
  }
}
