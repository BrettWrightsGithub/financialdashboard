/**
 * User Override - Apply manual category overrides
 * 
 * When a user manually categorizes a transaction:
 * 1. Updates the transaction's category
 * 2. Sets category_locked = TRUE (prevents future rule/Plaid overwrites)
 * 3. Records the override in category_overrides for audit
 * 4. Saves to payee memory for future transactions
 */

import { createServerSupabaseClient } from "../supabase";

export interface OverrideResult {
  success: boolean;
  oldCategoryId: string | null;
  newCategoryId: string;
  payeeLearned: boolean;
  error?: string;
}

/**
 * Apply a user override to a transaction.
 * This is the main function called when a user manually changes a category.
 */
export async function applyUserOverride(
  transactionId: string,
  newCategoryId: string,
  learnPayee: boolean = true
): Promise<OverrideResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc("fn_apply_user_override", {
    p_transaction_id: transactionId,
    p_new_category_id: newCategoryId,
    p_learn_payee: learnPayee,
  });

  if (error) {
    console.error("Error applying user override:", error);
    return {
      success: false,
      oldCategoryId: null,
      newCategoryId,
      payeeLearned: false,
      error: error.message,
    };
  }

  return {
    success: data?.success ?? false,
    oldCategoryId: data?.old_category_id ?? null,
    newCategoryId: data?.new_category_id ?? newCategoryId,
    payeeLearned: data?.payee_learned ?? false,
    error: data?.error,
  };
}

/**
 * Lock a transaction's category (prevent future overwrites).
 */
export async function lockTransactionCategory(transactionId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("transactions")
    .update({ category_locked: true, updated_at: new Date().toISOString() })
    .eq("id", transactionId);

  if (error) {
    console.error("Error locking transaction:", error);
    return false;
  }

  return true;
}

/**
 * Unlock a transaction's category (allow future rule/Plaid updates).
 */
export async function unlockTransactionCategory(transactionId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("transactions")
    .update({ category_locked: false, updated_at: new Date().toISOString() })
    .eq("id", transactionId);

  if (error) {
    console.error("Error unlocking transaction:", error);
    return false;
  }

  return true;
}

/**
 * Batch apply user override to multiple transactions.
 * Useful for bulk categorization.
 */
export async function applyBulkOverride(
  transactionIds: string[],
  newCategoryId: string,
  learnPayee: boolean = false // Don't learn from bulk operations by default
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const id of transactionIds) {
    const result = await applyUserOverride(id, newCategoryId, learnPayee);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get override history for a transaction.
 */
export async function getTransactionOverrideHistory(
  transactionId: string
): Promise<
  Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    source: string;
    createdAt: string;
  }>
> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("category_overrides")
    .select(`
      id,
      category_id,
      source,
      created_at,
      categories!category_id (name)
    `)
    .eq("created_from_transaction_id", transactionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching override history:", error);
    return [];
  }

  return (data || []).map((o) => ({
    id: o.id,
    categoryId: o.category_id,
    categoryName: (o.categories as unknown as { name: string } | null)?.name || "Unknown",
    source: o.source,
    createdAt: o.created_at,
  }));
}
