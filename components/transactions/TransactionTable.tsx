"use client";

import { useState } from "react";
import { formatCurrencyPrecise } from "@/lib/cashflow";
import { updateTransactionCategory } from "@/lib/queries";
import type { TransactionWithDetails, Category } from "@/types/database";

interface TransactionTableProps {
  transactions: TransactionWithDetails[];
  categories: Category[];
  onTransactionUpdate?: () => void;
}

export function TransactionTable({ transactions, categories, onTransactionUpdate }: TransactionTableProps) {

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No transactions found matching your filters.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={categories}
                  onUpdate={onTransactionUpdate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination placeholder */}
      {transactions.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>Showing {transactions.length} transactions</span>
          <div className="flex gap-2">
            {/* TODO: Add pagination controls */}
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow({
  transaction,
  categories,
  onUpdate,
}: {
  transaction: TransactionWithDetails;
  categories: Category[];
  onUpdate?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(transaction.life_category_id);
  const [saving, setSaving] = useState(false);

  const isIncome = transaction.amount >= 0;

  const handleCategoryChange = async (newCategoryId: string) => {
    setSelectedCategory(newCategoryId);
    setSaving(true);
    try {
      await updateTransactionCategory(transaction.id, newCategoryId);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update category:", error);
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      {/* Date */}
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {new Date(transaction.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </td>

      {/* Description */}
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {transaction.description_clean || transaction.description_raw}
        </div>
        {transaction.counterparty_name && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {transaction.counterparty_name}
          </div>
        )}
      </td>

      {/* Category (Editable) */}
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            value={selectedCategory || ""}
            onChange={(e) => handleCategoryChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="select text-sm py-1"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
          >
            {transaction.category_name}
            {transaction.category_locked && (
              <span className="text-xs" title="Manually set">🔒</span>
            )}
          </button>
        )}
      </td>

      {/* Account */}
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        {transaction.account_name}
      </td>

      {/* Amount */}
      <td className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${
        isIncome ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"
      }`}>
        {isIncome ? "+" : ""}
        {formatCurrencyPrecise(transaction.amount)}
      </td>

      {/* Flags */}
      <td className="px-4 py-3">
        <div className="flex justify-center gap-1">
          {transaction.is_transfer && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" title="Transfer">
              T
            </span>
          )}
          {transaction.is_pass_through && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" title="Pass-Through">
              P
            </span>
          )}
          {transaction.is_business && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" title="Business">
              B
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
