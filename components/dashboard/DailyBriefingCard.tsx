"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/types/database";

interface Suggestion {
  id: string;
  description_raw: string;
  amount: number;
  account_name: string | null;
  category_ai: string | null;
  priorityScore: number;
}

export function DailyBriefingCard() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const normalize = (value: string) =>
    value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const resolveCategory = (suggestion: Suggestion): Category | null => {
    const raw = normalize(suggestion.category_ai || "");
    if (!raw) return null;

    const exact = categories.find((category) => normalize(category.name) === raw);
    if (exact) return exact;

    const tokens = raw.split(" ").filter(Boolean);
    let best: { category: Category; score: number } | null = null;
    for (const category of categories) {
      const name = normalize(category.name);
      const score = tokens.reduce((acc, token) => acc + (name.includes(token) ? 1 : 0), 0);
      if (!best || score > best.score) {
        best = { category, score };
      }
    }
    return best && best.score > 0 ? best.category : null;
  };

  const categoryLabel = (suggestion: Suggestion) => {
    const resolved = resolveCategory(suggestion);
    if (resolved) return resolved.name;
    if (suggestion.category_ai) {
      return suggestion.category_ai
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }
    return "No suggestion";
  };

  useEffect(() => {
    Promise.all([fetch("/api/suggestions/top5"), fetch("/api/categories")])
      .then(async ([suggestionsResponse, categoriesResponse]) => {
        const suggestionsPayload = await suggestionsResponse.json();
        const categoriesPayload = await categoriesResponse.json();
        setSuggestions(suggestionsPayload.suggestions || []);
        setCategories(categoriesPayload.categories || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const approve = async (suggestion: Suggestion) => {
    const match = resolveCategory(suggestion);
    if (!match) return;

    setApprovingId(suggestion.id);

    const response = await fetch(`/api/transactions/${suggestion.id}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: match.id, learn_payee: true }),
    });

    if (response.ok) {
      setApprovedIds((prev) => new Set(prev).add(suggestion.id));
      window.setTimeout(() => {
        setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
      }, 600);
    }
    setApprovingId(null);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Daily Top 5</h2>
        <span className="text-xs text-slate-500">Priority queue</span>
      </div>

      {loading && <div className="text-sm text-slate-500">Loading suggestions…</div>}

      {!loading && suggestions.length === 0 && (
        <div className="text-sm text-green-700">All caught up. No uncategorized priority items.</div>
      )}

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className={`rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3 transition-all ${approvedIds.has(suggestion.id) ? "opacity-40 scale-[0.98]" : ""}`}>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{suggestion.description_raw}</div>
              <div className="text-xs text-slate-500">{suggestion.account_name} • score {suggestion.priorityScore.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{suggestion.amount.toFixed(2)}</div>
              <button
                type="button"
                className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white shadow-sm min-h-[44px] min-w-[140px] disabled:opacity-50"
                onClick={() => approve(suggestion)}
                disabled={!resolveCategory(suggestion) || approvingId === suggestion.id || approvedIds.has(suggestion.id)}
              >
                {approvedIds.has(suggestion.id)
                  ? "Approved"
                  : approvingId === suggestion.id
                  ? "Saving..."
                  : `Approve as ${categoryLabel(suggestion)}`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
