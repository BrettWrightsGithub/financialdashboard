/**
 * Reimbursement Handler - Link reimbursements to original expenses
 * 
 * Allows users to link incoming payments (reimbursements) to the original
 * expense they're reimbursing, for accurate cashflow reporting.
 */

import { createServerSupabaseClient } from "../supabase";
import type { Transaction } from "@/types/database";

export interface ReimbursementPair {
  original: Transaction;
  reimbursement: Transaction;
  netAmount: number;
}

/**
 * Link a reimbursement transaction to its original expense.
 * Sets reimbursement_of_id and optionally copies the category.
 */
export async function linkReimbursement(
  reimbursementTxId: string,
  originalExpenseTxId: string,
  copyCategory: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  // Get the original expense to copy category if needed
  let categoryId: string | null = null;
  if (copyCategory) {
    const { data: original, error: fetchError } = await supabase
      .from("transactions")
      .select("life_category_id")
      .eq("id", originalExpenseTxId)
      .single();

    if (fetchError) {
      return { success: false, error: `Failed to fetch original: ${fetchError.message}` };
    }
    categoryId = original?.life_category_id;
  }

  // Update the reimbursement transaction
  const updateData: Record<string, unknown> = {
    reimbursement_of_id: originalExpenseTxId,
    is_pass_through: true, // Mark as pass-through for cashflow
    updated_at: new Date().toISOString(),
  };

  if (categoryId) {
    updateData.life_category_id = categoryId;
    updateData.category_source = "reimbursement_link";
  }

  const { error } = await supabase
    .from("transactions")
    .update(updateData)
    .eq("id", reimbursementTxId);

  if (error) {
    return { success: false, error: `Failed to link: ${error.message}` };
  }

  return { success: true };
}

/**
 * Unlink a reimbursement from its original expense.
 */
export async function unlinkReimbursement(
  reimbursementTxId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("transactions")
    .update({
      reimbursement_of_id: null,
      is_pass_through: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reimbursementTxId);

  if (error) {
    return { success: false, error: `Failed to unlink: ${error.message}` };
  }

  return { success: true };
}

/**
 * Get all reimbursement pairs for a given month.
 * Returns linked original expense + reimbursement pairs.
 */
export async function getReimbursementPairs(
  month: string // Format: YYYY-MM
): Promise<ReimbursementPair[]> {
  const supabase = createServerSupabaseClient();

  // Get all reimbursements in the month
  const startDate = `${month}-01`;
  const endDate = new Date(
    new Date(startDate).getFullYear(),
    new Date(startDate).getMonth() + 1,
    0
  ).toISOString().split("T")[0];

  const { data: reimbursements, error } = await supabase
    .from("transactions")
    .select("*")
    .not("reimbursement_of_id", "is", null)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error || !reimbursements) {
    console.error("Error fetching reimbursements:", error);
    return [];
  }

  // Get the original expenses
  const originalIds = reimbursements.map((r) => r.reimbursement_of_id).filter(Boolean);
  if (originalIds.length === 0) return [];

  const { data: originals, error: originalsError } = await supabase
    .from("transactions")
    .select("*")
    .in("id", originalIds);

  if (originalsError || !originals) {
    console.error("Error fetching originals:", originalsError);
    return [];
  }

  // Build pairs
  const originalsMap = new Map(originals.map((o) => [o.id, o]));
  const pairs: ReimbursementPair[] = [];

  for (const reimbursement of reimbursements) {
    const original = originalsMap.get(reimbursement.reimbursement_of_id);
    if (original) {
      pairs.push({
        original: original as Transaction,
        reimbursement: reimbursement as Transaction,
        netAmount: original.amount + reimbursement.amount, // Should be close to 0 for full reimbursement
      });
    }
  }

  return pairs;
}

/**
 * Get potential reimbursement matches for an expense.
 * Finds incoming transactions that could be reimbursements for the given expense.
 */
export async function findPotentialReimbursements(
  expenseId: string,
  maxDaysDiff: number = 30
): Promise<Transaction[]> {
  const supabase = createServerSupabaseClient();

  // Get the expense
  const { data: expense, error: expenseError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", expenseId)
    .single();

  if (expenseError || !expense) {
    console.error("Error fetching expense:", expenseError);
    return [];
  }

  // Only look for reimbursements for outflows (expenses)
  if (expense.amount >= 0) return [];

  const expenseDate = new Date(expense.date);
  const searchStart = expense.date;
  const searchEnd = new Date(expenseDate.getTime() + maxDaysDiff * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Find incoming transactions with similar amount
  const targetAmount = Math.abs(expense.amount);
  const tolerance = targetAmount * 0.1; // 10% tolerance

  const { data: candidates, error } = await supabase
    .from("transactions")
    .select("*")
    .gt("amount", 0) // Inflows only
    .gte("date", searchStart)
    .lte("date", searchEnd)
    .gte("amount", targetAmount - tolerance)
    .lte("amount", targetAmount + tolerance)
    .is("reimbursement_of_id", null); // Not already linked

  if (error) {
    console.error("Error finding candidates:", error);
    return [];
  }

  return (candidates || []) as Transaction[];
}

/**
 * Get summary of reimbursements for cashflow reporting.
 */
export async function getReimbursementSummary(month: string): Promise<{
  totalReimbursed: number;
  pairCount: number;
  fullyReimbursed: number;
  partiallyReimbursed: number;
}> {
  const pairs = await getReimbursementPairs(month);

  let totalReimbursed = 0;
  let fullyReimbursed = 0;
  let partiallyReimbursed = 0;

  for (const pair of pairs) {
    totalReimbursed += pair.reimbursement.amount;
    
    // Check if fully reimbursed (net close to 0)
    if (Math.abs(pair.netAmount) < 1) {
      fullyReimbursed++;
    } else {
      partiallyReimbursed++;
    }
  }

  return {
    totalReimbursed,
    pairCount: pairs.length,
    fullyReimbursed,
    partiallyReimbursed,
  };
}
