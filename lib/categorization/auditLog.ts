/**
 * Audit Log - Track and retrieve category change history
 * 
 * Provides functions for logging category changes and retrieving audit history
 * for explainability and debugging purposes.
 */

import { createServerSupabaseClient } from "../supabase";

export type CategoryChangeSource = 
  | "plaid" 
  | "rule" 
  | "manual" 
  | "payee_memory" 
  | "bulk_edit" 
  | "reimbursement_link" 
  | "system";

export interface AuditLogEntry {
  id: string;
  transactionId: string;
  previousCategoryId: string | null;
  previousCategoryName: string | null;
  newCategoryId: string | null;
  newCategoryName: string | null;
  changeSource: CategoryChangeSource;
  ruleId: string | null;
  ruleName: string | null;
  confidenceScore: number | null;
  changedBy: string;
  batchId: string | null;
  notes: string | null;
  isReverted: boolean;
  createdAt: string;
}

export interface LogCategoryChangeParams {
  transactionId: string;
  previousCategoryId: string | null;
  newCategoryId: string | null;
  source: CategoryChangeSource;
  ruleId?: string;
  confidence?: number;
  changedBy?: string;
  batchId?: string;
  notes?: string;
}

/**
 * Log a category change to the audit log.
 */
export async function logCategoryChange(
  params: LogCategoryChangeParams
): Promise<{ success: boolean; logId?: string; error?: string }> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("category_audit_log")
    .insert({
      transaction_id: params.transactionId,
      previous_category_id: params.previousCategoryId,
      new_category_id: params.newCategoryId,
      change_source: params.source,
      rule_id: params.ruleId || null,
      confidence_score: params.confidence || null,
      changed_by: params.changedBy || "system",
      batch_id: params.batchId || null,
      notes: params.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging category change:", error);
    return { success: false, error: error.message };
  }

  return { success: true, logId: data?.id };
}

/**
 * Get audit history for a specific transaction.
 */
export async function getAuditHistory(
  transactionId: string
): Promise<AuditLogEntry[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("category_audit_log")
    .select(`
      id,
      transaction_id,
      previous_category_id,
      new_category_id,
      change_source,
      rule_id,
      confidence_score,
      changed_by,
      batch_id,
      notes,
      is_reverted,
      created_at,
      prev_cat:categories!previous_category_id(name),
      new_cat:categories!new_category_id(name),
      rule:categorization_rules!rule_id(name)
    `)
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching audit history:", error);
    return [];
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    transactionId: entry.transaction_id,
    previousCategoryId: entry.previous_category_id,
    previousCategoryName: (entry.prev_cat as unknown as { name: string } | null)?.name || null,
    newCategoryId: entry.new_category_id,
    newCategoryName: (entry.new_cat as unknown as { name: string } | null)?.name || null,
    changeSource: entry.change_source as CategoryChangeSource,
    ruleId: entry.rule_id,
    ruleName: (entry.rule as unknown as { name: string } | null)?.name || null,
    confidenceScore: entry.confidence_score,
    changedBy: entry.changed_by,
    batchId: entry.batch_id,
    notes: entry.notes,
    isReverted: entry.is_reverted,
    createdAt: entry.created_at,
  }));
}

/**
 * Get audit log entries by date range.
 */
export async function getAuditLogByDateRange(
  startDate: Date,
  endDate: Date,
  options?: {
    source?: CategoryChangeSource;
    limit?: number;
    offset?: number;
  }
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("category_audit_log")
    .select(`
      id,
      transaction_id,
      previous_category_id,
      new_category_id,
      change_source,
      rule_id,
      confidence_score,
      changed_by,
      batch_id,
      notes,
      is_reverted,
      created_at,
      prev_cat:categories!previous_category_id(name),
      new_cat:categories!new_category_id(name),
      rule:categorization_rules!rule_id(name)
    `, { count: "exact" })
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: false });

  if (options?.source) {
    query = query.eq("change_source", options.source);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching audit log:", error);
    return { entries: [], total: 0 };
  }

  const entries = (data || []).map((entry) => ({
    id: entry.id,
    transactionId: entry.transaction_id,
    previousCategoryId: entry.previous_category_id,
    previousCategoryName: (entry.prev_cat as unknown as { name: string } | null)?.name || null,
    newCategoryId: entry.new_category_id,
    newCategoryName: (entry.new_cat as unknown as { name: string } | null)?.name || null,
    changeSource: entry.change_source as CategoryChangeSource,
    ruleId: entry.rule_id,
    ruleName: (entry.rule as unknown as { name: string } | null)?.name || null,
    confidenceScore: entry.confidence_score,
    changedBy: entry.changed_by,
    batchId: entry.batch_id,
    notes: entry.notes,
    isReverted: entry.is_reverted,
    createdAt: entry.created_at,
  }));

  return { entries, total: count || 0 };
}

/**
 * Get recent audit activity summary.
 */
export async function getAuditSummary(days: number = 7): Promise<{
  totalChanges: number;
  bySource: Record<CategoryChangeSource, number>;
  recentBatches: number;
}> {
  const supabase = createServerSupabaseClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("category_audit_log")
    .select("change_source")
    .gte("created_at", startDate.toISOString());

  if (error) {
    console.error("Error fetching audit summary:", error);
    return {
      totalChanges: 0,
      bySource: {} as Record<CategoryChangeSource, number>,
      recentBatches: 0,
    };
  }

  const bySource: Record<string, number> = {};
  for (const entry of data || []) {
    bySource[entry.change_source] = (bySource[entry.change_source] || 0) + 1;
  }

  // Get recent batch count
  const { count: batchCount } = await supabase
    .from("rule_application_batches")
    .select("id", { count: "exact", head: true })
    .gte("applied_at", startDate.toISOString());

  return {
    totalChanges: data?.length || 0,
    bySource: bySource as Record<CategoryChangeSource, number>,
    recentBatches: batchCount || 0,
  };
}
