/**
 * Payee Memory - Learn from user categorizations
 * 
 * When a user manually categorizes a transaction, we remember the payee→category
 * mapping and apply it to future transactions with the same payee.
 */

import { createServerSupabaseClient } from "../supabase";

export interface PayeeMapping {
  categoryId: string;
  confidence: number;
}

/**
 * Normalize a payee name for consistent matching.
 * Removes common suffixes, lowercases, and strips special characters.
 */
export function normalizePayeeName(rawName: string): string {
  if (!rawName) return "";

  let normalized = rawName.toLowerCase().trim();

  // Remove common business suffixes
  normalized = normalized.replace(/\s+(inc|llc|ltd|corp|co|company)\.?$/i, "");

  // Remove common prefixes
  normalized = normalized.replace(/^(the|a|an)\s+/i, "");

  // Remove special characters except spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, "");

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ");

  return normalized.trim();
}

/**
 * Get the category mapping for a payee name.
 * Returns null if no mapping exists.
 */
export async function getPayeeMapping(payeeName: string): Promise<PayeeMapping | null> {
  const supabase = createServerSupabaseClient();
  const normalized = normalizePayeeName(payeeName);

  if (!normalized) return null;

  const { data, error } = await supabase.rpc("fn_get_payee_mapping", {
    p_payee_name: payeeName,
  });

  if (error) {
    console.error("Error getting payee mapping:", error);
    return null;
  }

  if (data && data.length > 0) {
    return {
      categoryId: data[0].category_id,
      confidence: data[0].confidence,
    };
  }

  return null;
}

/**
 * Save a payee→category mapping.
 * If the mapping already exists, it updates the category and increments usage count.
 */
export async function savePayeeMapping(
  payeeName: string,
  categoryId: string
): Promise<string | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc("fn_save_payee_mapping", {
    p_payee_name: payeeName,
    p_category_id: categoryId,
  });

  if (error) {
    console.error("Error saving payee mapping:", error);
    return null;
  }

  return data;
}

/**
 * Get all payee mappings for admin/debugging.
 */
export async function getAllPayeeMappings(): Promise<
  Array<{
    id: string;
    payeeName: string;
    categoryId: string;
    categoryName: string;
    usageCount: number;
    lastUsedAt: string;
  }>
> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("payee_category_mappings")
    .select(`
      id,
      payee_name,
      category_id,
      usage_count,
      last_used_at,
      categories!category_id (name)
    `)
    .order("usage_count", { ascending: false });

  if (error) {
    console.error("Error fetching payee mappings:", error);
    return [];
  }

  return (data || []).map((m) => ({
    id: m.id,
    payeeName: m.payee_name,
    categoryId: m.category_id,
    categoryName: (m.categories as unknown as { name: string } | null)?.name || "Unknown",
    usageCount: m.usage_count,
    lastUsedAt: m.last_used_at,
  }));
}

/**
 * Delete a payee mapping.
 */
export async function deletePayeeMapping(id: string): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("payee_category_mappings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting payee mapping:", error);
    throw new Error(`Failed to delete payee mapping: ${error.message}`);
  }
}
