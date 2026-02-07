import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { detectTransferCandidates } from "@/lib/categorization/transferDetection";
import type { Transaction } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run !== false;
    const autoFlag = body.autoflag === true;
    const minConfidence = Number(body.min_confidence ?? 0.7);

    const supabase = createServerSupabaseClient();

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("status", "posted")
      .eq("is_transfer", false)
      .is("transfer_pair_id", null)
      .order("date", { ascending: false })
      .limit(500);

    if (Array.isArray(body.transaction_ids) && body.transaction_ids.length > 0) {
      query = query.in("id", body.transaction_ids);
    }

    if (body.date_from) query = query.gte("date", body.date_from);
    if (body.date_to) query = query.lte("date", body.date_to);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const transactions = (data || []) as Transaction[];
    const candidates = detectTransferCandidates(transactions).filter(
      (candidate) => candidate.confidence >= minConfidence
    );

    if (!dryRun && autoFlag) {
      for (const candidate of candidates) {
        const txId = candidate.transaction.id;
        const counterpartId = candidate.counterpart?.id ?? null;

        await supabase
          .from("transactions")
          .update({
            is_transfer: true,
            transfer_pair_id: counterpartId,
            transfer_match_confidence: candidate.confidence,
            transfer_match_source: candidate.matchSource,
            updated_at: new Date().toISOString(),
          })
          .eq("id", txId);

        if (counterpartId) {
          await supabase
            .from("transactions")
            .update({
              is_transfer: true,
              transfer_pair_id: txId,
              transfer_match_confidence: candidate.confidence,
              transfer_match_source: candidate.matchSource,
              updated_at: new Date().toISOString(),
            })
            .eq("id", counterpartId);
        }
      }
    }

    return NextResponse.json({
      dry_run: dryRun,
      autoflag: autoFlag,
      total_scanned: transactions.length,
      detected_count: candidates.length,
      candidates: candidates.map((candidate) => ({
        transaction_id: candidate.transaction.id,
        counterpart_id: candidate.counterpart?.id || null,
        confidence: candidate.confidence,
        match_source: candidate.matchSource,
      })),
    });
  } catch (error) {
    console.error("Transfer detect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to detect transfers" },
      { status: 500 }
    );
  }
}
