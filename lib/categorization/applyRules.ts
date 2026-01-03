/**
 * Apply Rules - High-level categorization functions
 * 
 * Provides convenient wrappers for batch categorization operations.
 */

import { triggerCategorizationWaterfall } from "./ruleEngine";
import { createServerSupabaseClient } from "../supabase";
import type { WaterfallResult } from "@/types/database";

export interface CategorizedResult extends WaterfallResult {
  transaction_ids: string[];
  duration_ms: number;
}

/**
 * Categorize a batch of transactions using the waterfall logic.
 * Calls the stored procedure which applies: Rules → Payee Memory → Plaid defaults.
 */
export async function categorizeTransactions(
  transactionIds: string[]
): Promise<CategorizedResult> {
  const startTime = Date.now();

  const result = await triggerCategorizationWaterfall(transactionIds);

  return {
    ...result,
    transaction_ids: transactionIds,
    duration_ms: Date.now() - startTime,
  };
}

/**
 * Categorize all uncategorized transactions.
 * Fetches transactions without a category and runs the waterfall.
 */
export async function categorizeUncategorized(): Promise<CategorizedResult> {
  const supabase = createServerSupabaseClient();

  // Fetch uncategorized, unlocked transactions
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id")
    .is("life_category_id", null)
    .eq("category_locked", false)
    .limit(500); // Process in batches

  if (error) {
    throw new Error(`Failed to fetch uncategorized transactions: ${error.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return {
      processed: 0,
      rules_applied: 0,
      memory_applied: 0,
      plaid_applied: 0,
      skipped_locked: 0,
      uncategorized: 0,
      transaction_ids: [],
      duration_ms: 0,
    };
  }

  const transactionIds = transactions.map((t) => t.id);
  return categorizeTransactions(transactionIds);
}

/**
 * Categorize transactions for a specific date range.
 */
export async function categorizeByDateRange(
  startDate: string,
  endDate: string
): Promise<CategorizedResult> {
  const supabase = createServerSupabaseClient();

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id")
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("category_locked", false)
    .limit(1000);

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return {
      processed: 0,
      rules_applied: 0,
      memory_applied: 0,
      plaid_applied: 0,
      skipped_locked: 0,
      uncategorized: 0,
      transaction_ids: [],
      duration_ms: 0,
    };
  }

  const transactionIds = transactions.map((t) => t.id);
  return categorizeTransactions(transactionIds);
}

/**
 * Re-categorize transactions that were categorized by a specific rule.
 * Useful when a rule is updated and you want to re-apply it.
 */
export async function recategorizeByRule(ruleId: string): Promise<CategorizedResult> {
  const supabase = createServerSupabaseClient();

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("applied_rule_id", ruleId)
    .eq("category_locked", false);

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return {
      processed: 0,
      rules_applied: 0,
      memory_applied: 0,
      plaid_applied: 0,
      skipped_locked: 0,
      uncategorized: 0,
      transaction_ids: [],
      duration_ms: 0,
    };
  }

  // Clear the current categorization so waterfall can re-apply
  await supabase
    .from("transactions")
    .update({
      life_category_id: null,
      category_source: null,
      applied_rule_id: null,
    })
    .in("id", transactions.map((t) => t.id));

  const transactionIds = transactions.map((t) => t.id);
  return categorizeTransactions(transactionIds);
}
