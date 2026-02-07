"use client";

import { useEffect, useState } from "react";
import type { Category, TransactionWithDetails } from "@/types/database";

interface TransactionCardProps {
  transaction: TransactionWithDetails;
  categories: Category[];
  onUpdated: () => void;
}

export function TransactionCard({ transaction, categories, onUpdated }: TransactionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState(transaction.life_category_id || "");

  useEffect(() => {
    setPendingCategoryId(transaction.life_category_id || "");
  }, [transaction.id, transaction.life_category_id]);

  const updateCategory = async (categoryId: string) => {
    await fetch(`/api/transactions/${transaction.id}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, learn_payee: true }),
    });
    onUpdated();
  };

  const toggleFlag = async (flag: "is_transfer" | "is_pass_through" | "is_business") => {
    await fetch("/api/transactions/bulk-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_flags", transaction_ids: [transaction.id], flags: { [flag]: !transaction[flag] } }),
    });
    onUpdated();
  };

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{transaction.description_clean || transaction.description_raw}</div>
          <div className="text-xs text-slate-500 mt-1">{transaction.account_name} • {transaction.date}</div>
        </div>
        <button type="button" className="text-xs btn-secondary min-h-[44px]" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Less" : "More"}
        </button>
      </div>

      <div className="mt-2 text-lg font-semibold">{transaction.amount.toFixed(2)}</div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <select
            className="select min-h-[44px]"
            value={pendingCategoryId}
            onChange={(event) => setPendingCategoryId(event.target.value)}
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              className="btn-primary text-xs min-h-[44px]"
              onClick={() => pendingCategoryId && updateCategory(pendingCategoryId)}
              disabled={!pendingCategoryId || pendingCategoryId === (transaction.life_category_id || "")}
            >
              Confirm Category
            </button>
            <button
              className="btn-secondary text-xs min-h-[44px]"
              onClick={() => setPendingCategoryId(transaction.life_category_id || "")}
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button className="btn-secondary text-xs min-h-[44px]" onClick={() => toggleFlag("is_transfer")}>Transfer</button>
            <button className="btn-secondary text-xs min-h-[44px]" onClick={() => toggleFlag("is_pass_through")}>Pass-through</button>
            <button className="btn-secondary text-xs min-h-[44px]" onClick={() => toggleFlag("is_business")}>Business</button>
          </div>
        </div>
      )}
    </article>
  );
}
