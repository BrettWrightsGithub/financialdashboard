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

function getRpcErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown database error";
  const err = error as Record<string, unknown>;
  const code = typeof err.code === "string" ? err.code : undefined;
  const message = typeof err.message === "string" ? err.message : "Unknown database error";
  const details = typeof err.details === "string" ? err.details : undefined;
  const hint = typeof err.hint === "string" ? err.hint : undefined;
  const parts = [code ? `[${code}]` : null, message, details, hint].filter(Boolean);
  return parts.join(" ");
}

function isMissingSchemaObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as Record<string, unknown>;
  const code = typeof err.code === "string" ? err.code : "";
  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("undefined column")
  );
}

function shouldUseRetroactiveFallback(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("transactions_category_batch_id_fkey") ||
    lower.includes("category_batch_id") ||
    lower.includes("fk_audit_log_batch") ||
    lower.includes("fn_apply_rule_retroactive") ||
    lower.includes("undefined function")
  );
}

async function applyRuleRetroactivelyFallback(
  ruleId: string,
  transactionIds: string[],
  createdBy: string
): Promise<ApplyResult> {
  const supabase = createServerSupabaseClient();
  const batchId = crypto.randomUUID();

  const { data: rule, error: ruleError } = await supabase
    .from("categorization_rules")
    .select("id, name, is_active, assign_category_id, assign_is_transfer, assign_is_pass_through")
    .eq("id", ruleId)
    .single();

  if (ruleError || !rule || !rule.is_active) {
    throw new Error("Rule not found or inactive");
  }

  const description = `Retroactive application of rule: ${rule.name}`;

  const categoryBatchInsert = await supabase
    .from("category_batches")
    .insert({ id: batchId, operation_type: "rule_apply", description });
  if (categoryBatchInsert.error && !isMissingSchemaObjectError(categoryBatchInsert.error)) {
    throw new Error(getRpcErrorMessage(categoryBatchInsert.error));
  }

  const legacyBatchInsert = await supabase
    .from("rule_application_batches")
    .insert({
      id: batchId,
      rule_id: ruleId,
      operation_type: "rule_apply",
      transaction_count: 0,
      created_by: createdBy,
      description,
    });
  if (legacyBatchInsert.error && !isMissingSchemaObjectError(legacyBatchInsert.error)) {
    throw new Error(getRpcErrorMessage(legacyBatchInsert.error));
  }

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("id, life_category_id, category_locked")
    .in("id", transactionIds);
  if (txError) {
    throw new Error(getRpcErrorMessage(txError));
  }

  const byId = new Map((transactions || []).map((tx) => [tx.id, tx]));
  let appliedCount = 0;
  let skippedLocked = 0;

  for (const transactionId of transactionIds) {
    const tx = byId.get(transactionId);
    if (!tx) continue;
    if (tx.category_locked) {
      skippedLocked += 1;
      continue;
    }
    if (tx.life_category_id === rule.assign_category_id) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        life_category_id: rule.assign_category_id,
        is_transfer: rule.assign_is_transfer ?? undefined,
        is_pass_through: rule.assign_is_pass_through ?? undefined,
        category_source: "rule",
        applied_rule_id: ruleId,
        category_batch_id: batchId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateError) {
      throw new Error(getRpcErrorMessage(updateError));
    }

    // Best effort audit logging in fallback mode.
    const { error: auditError } = await supabase.rpc("fn_log_category_change", {
      p_transaction_id: transactionId,
      p_previous_category_id: tx.life_category_id,
      p_new_category_id: rule.assign_category_id,
      p_change_source: "rule",
      p_rule_id: ruleId,
      p_confidence_score: 1.0,
      p_changed_by: createdBy,
      p_batch_id: batchId,
      p_notes: "Retroactive rule application (fallback)",
    });
    if (auditError && !isMissingSchemaObjectError(auditError)) {
      console.warn("Fallback audit logging failed:", getRpcErrorMessage(auditError));
    }

    appliedCount += 1;
  }

  const legacyBatchUpdate = await supabase
    .from("rule_application_batches")
    .update({ transaction_count: appliedCount })
    .eq("id", batchId);
  if (legacyBatchUpdate.error && !isMissingSchemaObjectError(legacyBatchUpdate.error)) {
    console.warn("Legacy batch update failed:", getRpcErrorMessage(legacyBatchUpdate.error));
  }

  const categoryBatchUpdate = await supabase
    .from("category_batches")
    .update({ transaction_count: appliedCount })
    .eq("id", batchId);
  if (categoryBatchUpdate.error && !isMissingSchemaObjectError(categoryBatchUpdate.error)) {
    console.warn("Category batch update failed:", getRpcErrorMessage(categoryBatchUpdate.error));
  }

  return {
    batchId,
    appliedCount,
    skippedLocked,
  };
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

function normalizeDescription(value: string | null): string {
  return (value || "").toUpperCase();
}

function matchesRulePreview(
  rule: CategorizationRule,
  tx: Pick<Transaction, "description_raw" | "amount">
): boolean {
  const description = normalizeDescription(tx.description_raw);
  const amountAbs = Math.abs(tx.amount);
  const isOutflow = tx.amount < 0;

  if (rule.match_merchant_exact && description !== rule.match_merchant_exact.toUpperCase()) {
    return false;
  }
  if (
    rule.match_merchant_contains &&
    !description.includes(rule.match_merchant_contains.toUpperCase())
  ) {
    return false;
  }
  if (rule.match_amount_min !== null && amountAbs < rule.match_amount_min) {
    return false;
  }
  if (rule.match_amount_max !== null && amountAbs > rule.match_amount_max) {
    return false;
  }
  if (rule.match_direction === "outflow" && !isOutflow) {
    return false;
  }
  if (rule.match_direction === "inflow" && isOutflow) {
    return false;
  }
  return true;
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
  const matching = (transactions || [])
    .filter((tx) => matchesRulePreview(rule as unknown as CategorizationRule, tx as unknown as Pick<Transaction, "description_raw" | "amount">))
    .map((tx) => ({
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
): Promise<ApplyResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc("fn_apply_rule_retroactive", {
    p_rule_id: ruleId,
    p_transaction_ids: transactionIds,
    p_created_by: createdBy,
  });

  if (error) {
    const errorMessage = getRpcErrorMessage(error);
    console.error("Error applying rule retroactively:", errorMessage);
    if (shouldUseRetroactiveFallback(errorMessage)) {
      console.warn("Using retroactive apply fallback path due to schema mismatch.");
      return applyRuleRetroactivelyFallback(ruleId, transactionIds, createdBy);
    }
    throw new Error(errorMessage);
  }

  // RPC returns array with single row
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.batch_id) {
    throw new Error("Retroactive apply returned no batch_id.");
  }

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
