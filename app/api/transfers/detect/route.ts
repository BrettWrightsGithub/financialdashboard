import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { autoDetectTransfers } from "@/lib/categorization";
import type { TransactionWithDetails } from "@/types/database";

/**
 * POST /api/transfers/detect
 * 
 * Scans recent transactions to detect matching transfer pairs.
 * Uses heuristics like matching amounts (with fee tolerance), opposite signs, 
 * different accounts, and close dates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { lookback_days = 30, min_confidence = 0.8 } = body;

    const supabase = createServerSupabaseClient();
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookback_days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch transactions that are not already linked
    // We also fetch account name for better UI display later
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        *,
        accounts:account_id (
          name
        )
      `)
      .gte("date", startDateStr)
      .is("transfer_pair_id", null)
      .order("date", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        pairs: [],
        count: 0
      });
    }

    // Map to include account name in the flat object
    const flattenedTransactions = transactions.map((tx: any) => ({
      ...tx,
      account_name: tx.accounts?.name
    })) as TransactionWithDetails[];

    // Detect pairs
    const pairs = autoDetectTransfers(flattenedTransactions, undefined, min_confidence);

    // Build the result with full transaction details for the UI
    const detailedPairs = pairs.map(pair => {
      const outflow = flattenedTransactions.find(t => t.id === pair.outflowId);
      const inflow = flattenedTransactions.find(t => t.id === pair.inflowId);
      
      return {
        confidence: pair.confidence,
        outflow,
        inflow
      };
    });

    return NextResponse.json({
      success: true,
      pairs: detailedPairs,
      count: detailedPairs.length,
      params: {
        lookback_days,
        min_confidence,
        start_date: startDateStr
      }
    });

  } catch (error) {
    console.error("Transfer detection error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Transfer detection failed",
        success: false 
      },
      { status: 500 }
    );
  }
}
