/**
 * Bulk Edit Logic
 * Implements FR-11, C13 from docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md
 * 
 * Allows users to:
 * - Assign category to multiple transactions at once
 * - Mark multiple transactions as transfer/pass-through/business
 * - Optionally learn payee mappings from bulk edits
 */

import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types/database";

export interface BulkEditResult {
  success: boolean;
  updated: number;
  skipped: number;
  error?: string;
}

export interface BulkCategoryInput {
  transaction_ids: string[];
  category_id: string;
  learn_payee?: boolean; // Create payee memory for unique payees
}

export interface BulkFlagsInput {
  transaction_ids: string[];
  flags: {
    is_transfer?: boolean;
    is_pass_through?: boolean;
    is_business?: boolean;
  };
}

/**
 * Bulk assign category to multiple transactions
 * - Skips locked transactions unless force=true
 * - Sets category_source='manual' and category_locked=true
 * - Optionally creates payee memory entries
 */
export async function bulkAssignCategory(
  input: BulkCategoryInput
): Promise<BulkEditResult> {
  if (!supabase) {
    return { success: false, updated: 0, skipped: 0, error: "Supabase not configured" };
  }

  const { transaction_ids, category_id, learn_payee } = input;

  if (!transaction_ids.length) {
    return { success: false, updated: 0, skipped: 0, error: "No transactions provided" };
  }

  if (!category_id) {
    return { success: false, updated: 0, skipped: 0, error: "Category ID required" };
  }

  // Get category details for denormalized fields
  const { data: category, error: catError } = await supabase
    .from("categories")
    .select("id, name, cashflow_group")
    .eq("id", category_id)
    .single();

  if (catError || !category) {
    return { success: false, updated: 0, skipped: 0, error: "Category not found" };
  }

  // Fetch transactions to check locked status and get payee info
  const { data: transactions, error: fetchError } = await supabase
    .from("transactions")
    .select("id, description_raw, category_locked")
    .in("id", transaction_ids);

  if (fetchError) {
    return { success: false, updated: 0, skipped: 0, error: fetchError.message };
  }

  // Separate locked and unlocked
  const unlocked = transactions?.filter((t) => !t.category_locked) || [];
  const skipped = (transactions?.length || 0) - unlocked.length;

  if (unlocked.length === 0) {
    return {
      success: true,
      updated: 0,
      skipped,
      error: skipped > 0 ? "All selected transactions are locked" : undefined,
    };
  }

  const unlockedIds = unlocked.map((t) => t.id);

  // Update transactions
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      life_category_id: category_id,
      cashflow_group: category.cashflow_group,
      category_source: "manual",
      category_locked: true,
      updated_at: new Date().toISOString(),
    })
    .in("id", unlockedIds);

  if (updateError) {
    return { success: false, updated: 0, skipped, error: updateError.message };
  }

  // Optionally create payee memory entries for unique payees
  if (learn_payee) {
    const uniquePayees = new Set<string>();
    for (const t of unlocked) {
      if (t.description_raw) {
        // Extract a normalized payee pattern (first 50 chars, uppercase)
        const pattern = t.description_raw.substring(0, 50).toUpperCase().trim();
        if (pattern && !uniquePayees.has(pattern)) {
          uniquePayees.add(pattern);
        }
      }
    }

    // Create category_overrides for unique payees (payee memory)
    if (uniquePayees.size > 0) {
      const overrides = Array.from(uniquePayees).map((pattern) => ({
        description_pattern: pattern,
        category_id: category_id,
        is_active: true,
        source: "manual",
        priority: 0,
      }));

      // Insert, ignoring conflicts (pattern may already exist)
      await supabase
        .from("category_overrides")
        .upsert(overrides, { onConflict: "description_pattern", ignoreDuplicates: true });
    }
  }

  return {
    success: true,
    updated: unlocked.length,
    skipped,
  };
}

/**
 * Bulk update flags on multiple transactions
 */
export async function bulkUpdateFlags(
  input: BulkFlagsInput
): Promise<BulkEditResult> {
  if (!supabase) {
    return { success: false, updated: 0, skipped: 0, error: "Supabase not configured" };
  }

  const { transaction_ids, flags } = input;

  if (!transaction_ids.length) {
    return { success: false, updated: 0, skipped: 0, error: "No transactions provided" };
  }

  if (Object.keys(flags).length === 0) {
    return { success: false, updated: 0, skipped: 0, error: "No flags provided" };
  }

  const { error: updateError, count } = await supabase
    .from("transactions")
    .update({
      ...flags,
      updated_at: new Date().toISOString(),
    })
    .in("id", transaction_ids);

  if (updateError) {
    return { success: false, updated: 0, skipped: 0, error: updateError.message };
  }

  return {
    success: true,
    updated: transaction_ids.length,
    skipped: 0,
  };
}

/**
 * Bulk approve suggested categories (from Plaid/AI)
 * Locks the transactions with their current suggested category
 */
export async function bulkApproveCategories(
  transactionIds: string[]
): Promise<BulkEditResult> {
  if (!supabase) {
    return { success: false, updated: 0, skipped: 0, error: "Supabase not configured" };
  }

  if (!transactionIds.length) {
    return { success: false, updated: 0, skipped: 0, error: "No transactions provided" };
  }

  // Only approve transactions that have a category but aren't locked
  const { error: updateError, count } = await supabase
    .from("transactions")
    .update({
      category_locked: true,
      category_source: "manual", // User approved = manual
      updated_at: new Date().toISOString(),
    })
    .in("id", transactionIds)
    .not("life_category_id", "is", null)
    .eq("category_locked", false);

  if (updateError) {
    return { success: false, updated: 0, skipped: 0, error: updateError.message };
  }

  return {
    success: true,
    updated: transactionIds.length,
    skipped: 0,
  };
}
