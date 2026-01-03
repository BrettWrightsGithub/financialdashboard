/**
 * Transaction Splitting Logic
 * Implements FR-10, A20 from docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md
 * 
 * Parent-child model:
 * - Parent transaction is marked with is_split_child = false (it's the original)
 * - Child transactions have parent_transaction_id set and is_split_child = true
 * - Parent is excluded from cashflow calculations when it has children
 * - Children inherit parent's date, account, and other metadata
 */

import { supabase } from "@/lib/supabase";
import type { Transaction, SplitInput } from "@/types/database";

export interface SplitResult {
  success: boolean;
  parentId: string;
  children: Transaction[];
  error?: string;
}

export interface UnsplitResult {
  success: boolean;
  parentId: string;
  deletedCount: number;
  error?: string;
}

/**
 * Validates that split amounts sum to the parent amount (within tolerance)
 */
export function validateSplitAmounts(
  parentAmount: number,
  splits: SplitInput[]
): { valid: boolean; error?: string } {
  if (splits.length < 2) {
    return { valid: false, error: "At least 2 splits are required" };
  }

  const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
  const tolerance = 0.01; // Allow 1 cent tolerance for rounding

  if (Math.abs(Math.abs(totalSplit) - Math.abs(parentAmount)) > tolerance) {
    return {
      valid: false,
      error: `Split amounts (${totalSplit.toFixed(2)}) must equal parent amount (${parentAmount.toFixed(2)})`,
    };
  }

  // Validate each split has a positive amount
  for (const split of splits) {
    if (split.amount <= 0) {
      return { valid: false, error: "Each split must have a positive amount" };
    }
    if (!split.category_id) {
      return { valid: false, error: "Each split must have a category" };
    }
  }

  return { valid: true };
}

/**
 * Split a transaction into multiple child transactions
 * - Creates child transactions with parent_transaction_id set
 * - Each child gets its own category
 * - Parent is excluded from cashflow (has children)
 */
export async function splitTransaction(
  parentId: string,
  splits: SplitInput[]
): Promise<SplitResult> {
  if (!supabase) {
    return { success: false, parentId, children: [], error: "Supabase not configured" };
  }

  // Fetch parent transaction
  const { data: parent, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", parentId)
    .single();

  if (fetchError || !parent) {
    return {
      success: false,
      parentId,
      children: [],
      error: fetchError?.message || "Parent transaction not found",
    };
  }

  // Check if already split
  const { data: existingChildren } = await supabase
    .from("transactions")
    .select("id")
    .eq("parent_transaction_id", parentId);

  if (existingChildren && existingChildren.length > 0) {
    return {
      success: false,
      parentId,
      children: [],
      error: "Transaction is already split. Unsplit first to re-split.",
    };
  }

  // Cannot split a child transaction
  if (parent.is_split_child) {
    return {
      success: false,
      parentId,
      children: [],
      error: "Cannot split a child transaction",
    };
  }

  // Validate split amounts
  const validation = validateSplitAmounts(parent.amount, splits);
  if (!validation.valid) {
    return { success: false, parentId, children: [], error: validation.error };
  }

  // Determine sign for child amounts (parent amount sign)
  const sign = parent.amount < 0 ? -1 : 1;

  // Create child transactions
  const childInserts = splits.map((split, index) => ({
    provider: parent.provider,
    provider_transaction_id: `${parent.provider_transaction_id}_split_${index + 1}`,
    account_id: parent.account_id,
    provider_account_id: parent.provider_account_id,
    date: parent.date,
    amount: sign * Math.abs(split.amount), // Apply parent's sign
    description_raw: split.description || `${parent.description_raw} (Split ${index + 1})`,
    description_clean: split.description || parent.description_clean,
    life_category_id: split.category_id,
    status: parent.status,
    provider_type: parent.provider_type,
    counterparty_name: parent.counterparty_name,
    counterparty_id: parent.counterparty_id,
    is_transfer: parent.is_transfer,
    is_pass_through: parent.is_pass_through,
    is_business: parent.is_business,
    parent_transaction_id: parentId,
    is_split_child: true,
    category_source: "manual",
    category_locked: true,
  }));

  const { data: children, error: insertError } = await supabase
    .from("transactions")
    .insert(childInserts)
    .select();

  if (insertError) {
    return {
      success: false,
      parentId,
      children: [],
      error: `Failed to create split children: ${insertError.message}`,
    };
  }

  // Mark parent as split - this excludes it from cashflow, sync, and categorization
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      is_split_parent: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parentId);

  if (updateError) {
    console.error("Failed to mark parent as split:", updateError);
    // Don't fail the whole operation - children were created successfully
  }

  return {
    success: true,
    parentId,
    children: children || [],
  };
}

/**
 * Remove all child transactions and restore parent to normal state
 */
export async function unsplitTransaction(parentId: string): Promise<UnsplitResult> {
  if (!supabase) {
    return { success: false, parentId, deletedCount: 0, error: "Supabase not configured" };
  }

  // Verify parent exists and has children
  const { data: children, error: fetchError } = await supabase
    .from("transactions")
    .select("id")
    .eq("parent_transaction_id", parentId);

  if (fetchError) {
    return {
      success: false,
      parentId,
      deletedCount: 0,
      error: fetchError.message,
    };
  }

  if (!children || children.length === 0) {
    return {
      success: false,
      parentId,
      deletedCount: 0,
      error: "Transaction has no splits to remove",
    };
  }

  // Delete child transactions
  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("parent_transaction_id", parentId);

  if (deleteError) {
    return {
      success: false,
      parentId,
      deletedCount: 0,
      error: `Failed to delete split children: ${deleteError.message}`,
    };
  }

  // Clear the is_split_parent flag on the parent
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      is_split_parent: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parentId);

  if (updateError) {
    console.error("Failed to clear is_split_parent flag:", updateError);
    // Don't fail - children were deleted successfully
  }

  return {
    success: true,
    parentId,
    deletedCount: children.length,
  };
}

/**
 * Get all child transactions for a parent
 */
export async function getSplitChildren(parentId: string): Promise<Transaction[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("parent_transaction_id", parentId)
    .order("amount", { ascending: false });

  if (error) {
    console.error("Error fetching split children:", error);
    return [];
  }

  return data || [];
}

/**
 * Check if a transaction has been split (has children)
 */
export async function hasSplitChildren(transactionId: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("parent_transaction_id", transactionId);

  if (error) {
    console.error("Error checking for split children:", error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Get category details for display in split modal
 */
export async function getCategoryById(categoryId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, cashflow_group")
    .eq("id", categoryId)
    .single();

  if (error) {
    return null;
  }

  return data;
}
