import { createServerSupabaseClient } from "../supabase";
import { Transaction } from "@/types/database";

export interface TransferLinkResult {
  success: boolean;
  linkedCount: number;
  error?: string;
}

/**
 * Link two transactions as a transfer pair.
 * Sets the bidirectional link and updates the category to 'Internal Transfer'.
 */
export async function linkTransferPair(
  outflowId: string,
  inflowId: string,
  confidence: number
): Promise<TransferLinkResult> {
  const supabase = createServerSupabaseClient();

  // 1. Get the "Internal Transfer" category ID
  const { data: category, error: catError } = await supabase
    .from("categories")
    .select("id")
    .eq("name", "Internal Transfer")
    .eq("cashflow_group", "Transfer")
    .single();

  if (catError || !category) {
    return {
      success: false,
      linkedCount: 0,
      error: "Could not find 'Internal Transfer' category. Please ensure migrations have run.",
    };
  }

  const categoryId = category.id;

  // 2. Perform updates in a single operation (using RPC or separate calls)
  // We'll use separate calls for simplicity, but in a real app, a stored proc would be better.
  
  // Update Outflow
  const { error: error1 } = await supabase
    .from("transactions")
    .update({
      transfer_pair_id: inflowId,
      transfer_confidence: confidence,
      life_category_id: categoryId,
      is_transfer: true,
      category_source: 'rule',
      updated_at: new Date().toISOString()
    })
    .eq("id", outflowId);

  if (error1) return { success: false, linkedCount: 0, error: error1.message };

  // Update Inflow
  const { error: error2 } = await supabase
    .from("transactions")
    .update({
      transfer_pair_id: outflowId,
      transfer_confidence: confidence,
      life_category_id: categoryId,
      is_transfer: true,
      category_source: 'rule',
      updated_at: new Date().toISOString()
    })
    .eq("id", inflowId);

  if (error2) return { success: false, linkedCount: 1, error: error2.message };

  return { success: true, linkedCount: 2 };
}

/**
 * Bulk link multiple transfer pairs.
 */
export async function bulkLinkTransfers(
  pairs: Array<{ outflowId: string; inflowId: string; confidence: number }>
): Promise<TransferLinkResult> {
  let linkedCount = 0;
  
  for (const pair of pairs) {
    const result = await linkTransferPair(pair.outflowId, pair.inflowId, pair.confidence);
    if (result.success) {
      linkedCount += result.linkedCount;
    } else {
      console.error(`Failed to link pair ${pair.outflowId}<->${pair.inflowId}:`, result.error);
    }
  }

  return { success: true, linkedCount };
}
