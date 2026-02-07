import { createServerSupabaseClient } from "@/lib/supabase";

export interface ScoringFactors {
  frequency: number;
  amount: number;
  uncertainty: number;
}

export interface TopSuggestion {
  id: string;
  description_raw: string;
  amount: number;
  date: string;
  category_ai: string | null;
  category_confidence: number | null;
  account_name: string | null;
  priorityScore: number;
}

export function calculatePriorityScore(factors: ScoringFactors): number {
  const frequencyNormalized = Math.min(Math.max(factors.frequency, 0) / 10, 1);
  const amountNormalized = Math.min(Math.max(Math.abs(factors.amount), 0) / 500, 1);
  const uncertaintyNormalized = Math.min(Math.max(factors.uncertainty, 0), 1);
  return Number((frequencyNormalized * 0.4 + amountNormalized * 0.3 + uncertaintyNormalized * 0.3).toFixed(4));
}

function normalizeMerchant(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
}

export async function getTop5Suggestions(): Promise<TopSuggestion[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("id, description_raw, amount, date, category_ai, category_confidence, accounts(name)")
    .is("life_category_id", null)
    .eq("status", "posted")
    .eq("is_split_child", false)
    .order("date", { ascending: false })
    .limit(120);

  if (error || !data) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const item of data) {
    const key = normalizeMerchant(item.description_raw || "");
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return data
    .map((item) => {
      const key = normalizeMerchant(item.description_raw || "");
      const frequency = counts.get(key) || 1;
      const uncertainty = 1 - (item.category_confidence ?? 0);
      return {
        id: item.id,
        description_raw: item.description_raw,
        amount: item.amount,
        date: item.date,
        category_ai: item.category_ai,
        category_confidence: item.category_confidence,
        account_name: ((item.accounts as { name?: string } | null)?.name || null) as string | null,
        priorityScore: calculatePriorityScore({
          frequency,
          amount: Math.abs(item.amount),
          uncertainty,
        }),
      };
    })
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 5);
}
