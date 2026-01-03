/**
 * Retroactive Rules - Apply rules to past transactions with undo support
 * 
 * Provides:
 * - Preview of rule application (dry run)
 * - Retroactive application with batch tracking
 * - Undo capability via stored procedure
 */

import { createServerSupabaseClient } from "../supabase";
import type { Transaction, CategorizationRule } from "@/types/database";

export interface PreviewResult {
  ruleId: string;
  ruleName: string;
  matchingTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    currentCategory: string | null;
    newCategory: string;
    isLocked: boolean;
  }>;
  totalMatching: number;
  wouldChange: number;
  wouldSkipLocked: number;
}

export interface ApplyResult {
  batchId: string;
  appliedCount: number;
  skippedLocked: number;
}

export interface BatchInfo {
  id: string;
  ruleId: string | null;
  ruleName: string | null;
  operationType: string;
  appliedAt: string;
  transactionCount: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  isUndone: boolean;
  undoneAt: string | null;
  description: string | null;
}

/**
 * Preview what transactions would be affected by applying a rule.
 * Does NOT modify any data.
 */
export async function previewRuleApplication(
  ruleId: string,
  dateRange?: { start: Date; end: Date }
): Promise<PreviewResult | null> {
  const supabase = createServerSupabaseClient();

  // Get the rule
  const { data: rule, error: ruleError } = await supabase
    .from("categorization_rules")
    .select("*, categories!assign_category_id(name)")
    .eq("id", ruleId)
    .single();

  if (ruleError || !rule) {
    console.error("Rule not found:", ruleError);
    return null;
  }

  // Build query for matching transactions
  let query = supabase
    .from("transactions")
    .select(`
      id,
      date,
      description_raw,
      amount,
      life_category_id,
      category_locked,
      categories!life_category_id(name)
    `)
    .eq("status", "posted");

  // Apply rule match conditions
  if (rule.match_merchant_contains) {
    query = query.ilike("description_raw", `%${rule.match_merchant_contains}%`);
  }
  if (rule.match_merchant_exact) {
    query = query.ilike("description_raw", rule.match_merchant_exact);
  }
  if (rule.match_amount_min !== null) {
    query = query.gte("amount", rule.match_amount_min);
  }
  if (rule.match_amount_max !== null) {
    query = query.lte("amount", rule.match_amount_max);
  }
  if (rule.match_account_id) {
    query = query.eq("account_id", rule.match_account_id);
  }
  if (rule.match_direction === "inflow") {
    query = query.gt("amount", 0);
  } else if (rule.match_direction === "outflow") {
    query = query.lt("amount", 0);
  }

  // Apply date range filter
  if (dateRange) {
    query = query
      .gte("date", dateRange.start.toISOString().split("T")[0])
      .lte("date", dateRange.end.toISOString().split("T")[0]);
  }

  const { data: transactions, error: txError } = await query.limit(500);

  if (txError) {
    console.error("Error fetching transactions:", txError);
    return null;
  }

  const targetCategoryName = (rule.categories as unknown as { name: string } | null)?.name || "Unknown";

  // Filter out transactions that already have the target category
  const matching = (transactions || []).map((tx) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description_raw || "",
    amount: tx.amount,
    currentCategory: (tx.categories as unknown as { name: string } | null)?.name || null,
    newCategory: targetCategoryName,
    isLocked: tx.category_locked || false,
  }));

  const wouldChange = matching.filter(
    (tx) => !tx.isLocked && tx.currentCategory !== targetCategoryName
  ).length;

  const wouldSkipLocked = matching.filter((tx) => tx.isLocked).length;

  return {
    ruleId,
    ruleName: rule.name,
    matchingTransactions: matching,
    totalMatching: matching.length,
    wouldChange,
    wouldSkipLocked,
  };
}

/**
 * Apply a rule retroactively to specified transactions.
 * Creates a batch record and calls the stored procedure.
 */
export async function applyRuleRetroactively(
  ruleId: string,
  transactionIds: string[],
  createdBy: string = "system"
): Promise<ApplyResult | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc("fn_apply_rule_retroactive", {
    p_rule_id: ruleId,
    p_transaction_ids: transactionIds,
    p_created_by: createdBy,
  });

  if (error) {
    console.error("Error applying rule retroactively:", error);
    return null;
  }

  // RPC returns array with single row
  const result = Array.isArray(data) ? data[0] : data;

  return {
    batchId: result.batch_id,
    appliedCount: result.applied_count,
    skippedLocked: result.skipped_locked,
  };
}

/**
 * Undo a batch operation.
 * Reverts all category changes made in the batch.
 */
export async function undoBatch(
  batchId: string
): Promise<{ success: boolean; transactionsReverted: number; error?: string }> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc("fn_undo_batch", {
    p_batch_id: batchId,
  });

  if (error) {
    console.error("Error undoing batch:", error);
    return { success: false, transactionsReverted: 0, error: error.message };
  }

  // RPC returns array with single row
  const result = Array.isArray(data) ? data[0] : data;

  return {
    success: result.success,
    transactionsReverted: result.transactions_reverted,
    error: result.error || undefined,
  };
}

/**
 * Get all batches with optional filtering.
 */
export async function getBatches(options?: {
  ruleId?: string;
  includeUndone?: boolean;
  limit?: number;
}): Promise<BatchInfo[]> {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("rule_application_batches")
    .select(`
      id,
      rule_id,
      operation_type,
      applied_at,
      transaction_count,
      date_range_start,
      date_range_end,
      is_undone,
      undone_at,
      description,
      categorization_rules!rule_id(name)
    `)
    .order("applied_at", { ascending: false });

  if (options?.ruleId) {
    query = query.eq("rule_id", options.ruleId);
  }

  if (!options?.includeUndone) {
    query = query.eq("is_undone", false);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching batches:", error);
    return [];
  }

  return (data || []).map((batch) => ({
    id: batch.id,
    ruleId: batch.rule_id,
    ruleName: (batch.categorization_rules as unknown as { name: string } | null)?.name || null,
    operationType: batch.operation_type,
    appliedAt: batch.applied_at,
    transactionCount: batch.transaction_count,
    dateRangeStart: batch.date_range_start,
    dateRangeEnd: batch.date_range_end,
    isUndone: batch.is_undone,
    undoneAt: batch.undone_at,
    description: batch.description,
  }));
}

/**
 * Get a specific batch by ID.
 */
export async function getBatch(batchId: string): Promise<BatchInfo | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("rule_application_batches")
    .select(`
      id,
      rule_id,
      operation_type,
      applied_at,
      transaction_count,
      date_range_start,
      date_range_end,
      is_undone,
      undone_at,
      description,
      categorization_rules!rule_id(name)
    `)
    .eq("id", batchId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    ruleId: data.rule_id,
    ruleName: (data.categorization_rules as unknown as { name: string } | null)?.name || null,
    operationType: data.operation_type,
    appliedAt: data.applied_at,
    transactionCount: data.transaction_count,
    dateRangeStart: data.date_range_start,
    dateRangeEnd: data.date_range_end,
    isUndone: data.is_undone,
    undoneAt: data.undone_at,
    description: data.description,
  };
}
