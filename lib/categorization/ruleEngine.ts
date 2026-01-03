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
  WaterfallResult 
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
 */
export async function triggerCategorizationWaterfall(
  transactionIds: string[]
): Promise<WaterfallResult> {
  const supabase = createServerSupabaseClient();

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
