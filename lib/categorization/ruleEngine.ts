/**
 * Rule Engine - TypeScript wrapper for categorization stored procedures
 * 
 * The core rule matching logic lives in Supabase stored procedures (The Engine).
 * This module provides a thin wrapper for calling those procedures from the app.
 */

import { createServerSupabaseClient } from "../supabase";
import type { 
  CategorizationRule, 
  CategorizationRuleWithCategory,
  Transaction,
  WaterfallResult,
  UndoBatchResult,
  CategorizationStats
} from "@/types/database";

// Rule match result for UI preview
export interface RuleMatch {
  rule: CategorizationRule;
  matchedOn: "merchant_exact" | "merchant_contains" | "amount" | "account" | "direction";
  confidence: number;
}

/**
 * Trigger the categorization waterfall stored procedure for a batch of transactions.
 * This is the main entry point for categorizing transactions.
 * 
 * @param transactionIds - Array of transaction UUIDs to categorize
 * @param batchId - Optional batch ID for grouping (requires enhanced stored procedure)
 * 
 * Note: If batch_id is provided but the enhanced stored procedure isn't deployed yet,
 * it will fall back to the basic version that only takes transaction IDs.
 */
export async function triggerCategorizationWaterfall(
  transactionIds: string[],
  batchId?: string
): Promise<WaterfallResult> {
  const supabase = createServerSupabaseClient();

  // Try enhanced version with batch_id first
  if (batchId) {
    const { data, error } = await supabase.rpc("fn_run_categorization_waterfall", {
      p_batch_id: batchId,
      p_transaction_ids: transactionIds,
    });

    // If enhanced version works, return result
    if (!error) {
      return data as WaterfallResult;
    }

    // If error is about function signature, fall back to basic version
    console.warn("Enhanced waterfall not available, falling back to basic version");
  }

  // Basic version (current DB schema)
  const { data, error } = await supabase.rpc("fn_run_categorization_waterfall", {
    p_transaction_ids: transactionIds,
  });

  if (error) {
    console.error("Error running categorization waterfall:", error);
    throw new Error(`Categorization failed: ${error.message}`);
  }

  // The stored procedure returns a JSON object with statistics
  return data as WaterfallResult;
}

/**
 * Simple wrapper that auto-creates a batch for categorization.
 * Falls back to basic waterfall if fn_categorize_transactions isn't deployed.
 */
export async function categorizeTransactionsSimple(
  transactionIds: string[]
): Promise<WaterfallResult> {
  const supabase = createServerSupabaseClient();

  // Try the convenience wrapper first
  const { data, error } = await supabase.rpc("fn_categorize_transactions", {
    p_transaction_ids: transactionIds,
  });

  if (error) {
    // Fall back to basic waterfall if wrapper not deployed
    if (error.message.includes("function") || error.code === "42883") {
      console.warn("fn_categorize_transactions not available, using basic waterfall");
      return triggerCategorizationWaterfall(transactionIds);
    }
    console.error("Error categorizing transactions:", error);
    throw new Error(`Categorization failed: ${error.message}`);
  }

  return data as WaterfallResult;
}

/**
 * Undo a batch operation with detailed results.
 * Falls back to fn_undo_batch if enhanced version not deployed.
 */
export async function undoBatchDetailed(
  batchId: string
): Promise<UndoBatchResult> {
  const supabase = createServerSupabaseClient();

  // Try enhanced version first
  const { data: detailedData, error: detailedError } = await supabase.rpc("fn_undo_batch_detailed", {
    p_batch_id: batchId,
  });

  if (!detailedError) {
    return detailedData as UndoBatchResult;
  }

  // Fall back to basic fn_undo_batch if enhanced not available
  if (detailedError.message.includes("function") || detailedError.code === "42883") {
    console.warn("fn_undo_batch_detailed not available, using basic undo");
    const { data, error } = await supabase.rpc("fn_undo_batch", {
      p_batch_id: batchId,
    });

    if (error) {
      console.error("Error undoing batch:", error);
      return { success: false, error: error.message };
    }

    // Basic version returns TABLE(success, transactions_reverted, error)
    const result = Array.isArray(data) ? data[0] : data;
    return {
      success: result?.success ?? false,
      reverted: result?.transactions_reverted ?? 0,
      error: result?.error || undefined,
    };
  }

  console.error("Error undoing batch:", detailedError);
  return { success: false, error: detailedError.message };
}

/**
 * Get categorization statistics for a date range.
 * Falls back to client-side calculation if stored procedure not deployed.
 */
export async function getCategorizationStats(
  startDate?: Date,
  endDate?: Date
): Promise<CategorizationStats> {
  const supabase = createServerSupabaseClient();

  // Try stored procedure first
  const { data, error } = await supabase.rpc("fn_get_categorization_stats", {
    p_start_date: startDate?.toISOString().split("T")[0] || null,
    p_end_date: endDate?.toISOString().split("T")[0] || null,
  });

  if (!error) {
    return data as CategorizationStats;
  }

  // Fall back to client-side calculation if function not deployed
  if (error.message.includes("function") || error.code === "42883") {
    console.warn("fn_get_categorization_stats not available, calculating client-side");
    return calculateStatsClientSide(supabase, startDate, endDate);
  }

  console.error("Error getting categorization stats:", error);
  throw new Error(`Failed to get stats: ${error.message}`);
}

/**
 * Client-side fallback for categorization stats.
 */
async function calculateStatsClientSide(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  startDate?: Date,
  endDate?: Date
): Promise<CategorizationStats> {
  // Default to current month
  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  let query = supabase
    .from("transactions")
    .select("id, life_category_id, category_source, category_locked")
    .eq("status", "posted")
    .gte("date", start.toISOString().split("T")[0])
    .lte("date", end.toISOString().split("T")[0]);

  const { data: transactions, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  const total = transactions?.length || 0;
  const categorized = transactions?.filter(t => t.life_category_id !== null).length || 0;
  const locked = transactions?.filter(t => t.category_locked).length || 0;

  const bySource: Record<string, number> = {};
  for (const tx of transactions || []) {
    const source = tx.category_source || "uncategorized";
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return {
    date_range: {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    },
    total,
    categorized,
    uncategorized: total - categorized,
    locked,
    by_source: bySource,
    categorization_rate: total > 0 ? Math.round((categorized / total) * 1000) / 10 : 0,
  };
}

/**
 * Fetch all active rules ordered by priority (highest first).
 */
export async function getActiveRules(): Promise<CategorizationRuleWithCategory[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("categorization_rules")
    .select(`
      *,
      categories!assign_category_id (name)
    `)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (error) {
    console.error("Error fetching rules:", error);
    throw new Error(`Failed to fetch rules: ${error.message}`);
  }

  return (data || []).map((rule) => ({
    ...rule,
    category_name: rule.categories?.name || "Unknown",
  }));
}

/**
 * Fetch all rules (including inactive) for admin management.
 */
export async function getAllRules(): Promise<CategorizationRuleWithCategory[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("categorization_rules")
    .select(`
      *,
      categories!assign_category_id (name)
    `)
    .order("priority", { ascending: false });

  if (error) {
    console.error("Error fetching rules:", error);
    throw new Error(`Failed to fetch rules: ${error.message}`);
  }

  return (data || []).map((rule) => ({
    ...rule,
    category_name: rule.categories?.name || "Unknown",
  }));
}

/**
 * Preview which rule would match a transaction (client-side simulation).
 * Does NOT modify data - for UI preview only.
 */
export async function evaluateRulesPreview(
  transaction: Pick<Transaction, "description_raw" | "amount" | "account_id">
): Promise<RuleMatch | null> {
  const rules = await getActiveRules();
  const description = (transaction.description_raw || "").toUpperCase();
  const amount = transaction.amount;
  const isOutflow = amount < 0;

  for (const rule of rules) {
    let matched = false;
    let matchedOn: RuleMatch["matchedOn"] = "merchant_contains";

    // Check merchant exact match
    if (rule.match_merchant_exact) {
      if (description === rule.match_merchant_exact.toUpperCase()) {
        matched = true;
        matchedOn = "merchant_exact";
      }
    }

    // Check merchant contains match
    if (!matched && rule.match_merchant_contains) {
      if (description.includes(rule.match_merchant_contains.toUpperCase())) {
        matched = true;
        matchedOn = "merchant_contains";
      }
    }

    // If no merchant match criteria, check other conditions
    if (!rule.match_merchant_exact && !rule.match_merchant_contains) {
      matched = true; // Will be filtered by other conditions
    }

    if (!matched) continue;

    // Check amount range
    if (rule.match_amount_min !== null) {
      if (Math.abs(amount) < rule.match_amount_min) continue;
    }
    if (rule.match_amount_max !== null) {
      if (Math.abs(amount) > rule.match_amount_max) continue;
    }

    // Check direction
    if (rule.match_direction) {
      if (rule.match_direction === "outflow" && !isOutflow) continue;
      if (rule.match_direction === "inflow" && isOutflow) continue;
    }

    // Check account
    if (rule.match_account_id) {
      if (transaction.account_id !== rule.match_account_id) continue;
    }

    // Rule matches!
    return {
      rule,
      matchedOn,
      confidence: 95, // Rules are high confidence
    };
  }

  return null;
}

/**
 * Create a new categorization rule.
 */
export async function createRule(
  rule: Omit<CategorizationRule, "id" | "created_at" | "updated_at">
): Promise<CategorizationRule> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("categorization_rules")
    .insert(rule)
    .select()
    .single();

  if (error) {
    console.error("Error creating rule:", error);
    throw new Error(`Failed to create rule: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing categorization rule.
 */
export async function updateRule(
  id: string,
  updates: Partial<Omit<CategorizationRule, "id" | "created_at" | "updated_at">>
): Promise<CategorizationRule> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("categorization_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating rule:", error);
    throw new Error(`Failed to update rule: ${error.message}`);
  }

  return data;
}

/**
 * Delete a categorization rule.
 */
export async function deleteRule(id: string): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("categorization_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting rule:", error);
    throw new Error(`Failed to delete rule: ${error.message}`);
  }
}

/**
 * Update rule priorities (for drag-and-drop reordering).
 */
export async function updateRulePriorities(
  priorityUpdates: { id: string; priority: number }[]
): Promise<void> {
  const supabase = createServerSupabaseClient();

  // Update each rule's priority
  for (const update of priorityUpdates) {
    const { error } = await supabase
      .from("categorization_rules")
      .update({ priority: update.priority, updated_at: new Date().toISOString() })
      .eq("id", update.id);

    if (error) {
      console.error("Error updating rule priority:", error);
      throw new Error(`Failed to update rule priority: ${error.message}`);
    }
  }
}
