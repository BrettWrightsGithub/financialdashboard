/**
 * Review Queue Logic
 * Implements FR-13 from docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md
 * 
 * Returns transactions needing user attention:
 * - Uncategorized (life_category_id IS NULL)
 * - Low confidence (category_confidence < 0.7)
 * - Plaid-categorized P2P or large amounts that may need review
 */

import { supabase } from "@/lib/supabase";
import type { TransactionWithDetails } from "@/types/database";

export interface ReviewQueueFilters {
  month?: string; // YYYY-MM format
  sortBy?: "date" | "confidence" | "amount";
  sortOrder?: "asc" | "desc";
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const LARGE_AMOUNT_THRESHOLD = 500; // Transactions over $500 may need review

/**
 * Get transactions that need user review
 */
export async function getReviewQueueTransactions(
  filters?: ReviewQueueFilters
): Promise<TransactionWithDetails[]> {
  if (!supabase) {
    console.warn("Supabase not configured");
    return [];
  }

  // Query transactions table with joins for category/account names
  // The view doesn't have category_confidence, so we query directly
  let query = supabase
    .from("transactions")
    .select(`
      *,
      accounts!inner(name),
      categories(name)
    `)
    .eq("status", "posted")
    .eq("is_split_child", false) // Don't show split children in review queue
    .or(
      `life_category_id.is.null,` +
      `category_confidence.lt.${LOW_CONFIDENCE_THRESHOLD},` +
      `and(category_source.eq.plaid,amount.lt.${-LARGE_AMOUNT_THRESHOLD})`
    );

  // Filter by month if provided
  if (filters?.month) {
    const startDate = `${filters.month}-01`;
    const [year, month] = filters.month.split("-").map(Number);
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    query = query.gte("date", startDate).lte("date", endDate);
  }

  // Apply sorting
  const sortBy = filters?.sortBy || "date";
  const sortOrder = filters?.sortOrder || "desc";
  
  switch (sortBy) {
    case "confidence":
      query = query.order("category_confidence", { ascending: sortOrder === "asc", nullsFirst: true });
      break;
    case "amount":
      query = query.order("amount", { ascending: sortOrder === "asc" });
      break;
    default:
      query = query.order("date", { ascending: sortOrder === "asc" });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching review queue:", error);
    return [];
  }

  // Transform the joined data to match TransactionWithDetails
  return (data || []).map((t: any) => ({
    ...t,
    account_name: t.accounts?.name,
    category_name: t.categories?.name,
  }));
}

/**
 * Get count of transactions needing review (for badge display)
 */
export async function getReviewQueueCount(month?: string): Promise<number> {
  if (!supabase) {
    return 0;
  }

  let query = supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "posted")
    .eq("is_split_child", false)
    .or(
      `life_category_id.is.null,` +
      `category_confidence.lt.${LOW_CONFIDENCE_THRESHOLD}`
    );

  if (month) {
    const startDate = `${month}-01`;
    const [year, monthNum] = month.split("-").map(Number);
    const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
    query = query.gte("date", startDate).lte("date", endDate);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error fetching review queue count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if a transaction needs review
 */
export function needsReview(transaction: {
  life_category_id: string | null;
  category_confidence: number | null;
  category_source: string | null;
  amount: number;
}): boolean {
  // Uncategorized
  if (!transaction.life_category_id) {
    return true;
  }

  // Low confidence
  if (
    transaction.category_confidence !== null &&
    transaction.category_confidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    return true;
  }

  // Plaid-categorized large expense
  if (
    transaction.category_source === "plaid" &&
    transaction.amount < -LARGE_AMOUNT_THRESHOLD
  ) {
    return true;
  }

  return false;
}

/**
 * Get review queue summary stats
 */
export async function getReviewQueueStats(month?: string): Promise<{
  total: number;
  uncategorized: number;
  lowConfidence: number;
  needsAttention: number;
}> {
  if (!supabase) {
    return { total: 0, uncategorized: 0, lowConfidence: 0, needsAttention: 0 };
  }

  // Build date filter
  let dateFilter = "";
  if (month) {
    const startDate = `${month}-01`;
    const [year, monthNum] = month.split("-").map(Number);
    const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
    dateFilter = `and(date.gte.${startDate},date.lte.${endDate})`;
  }

  const baseFilter = "status.eq.posted,is_split_child.eq.false";

  // Get counts in parallel
  const [uncategorizedRes, lowConfidenceRes, totalRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "posted")
      .eq("is_split_child", false)
      .is("life_category_id", null),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "posted")
      .eq("is_split_child", false)
      .not("life_category_id", "is", null)
      .lt("category_confidence", LOW_CONFIDENCE_THRESHOLD),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "posted")
      .eq("is_split_child", false),
  ]);

  const uncategorized = uncategorizedRes.count || 0;
  const lowConfidence = lowConfidenceRes.count || 0;
  const total = totalRes.count || 0;

  return {
    total,
    uncategorized,
    lowConfidence,
    needsAttention: uncategorized + lowConfidence,
  };
}
