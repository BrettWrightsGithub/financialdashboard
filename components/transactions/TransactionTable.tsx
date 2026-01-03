"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrencyPrecise } from "@/lib/cashflow";
import { updateTransactionCategory, updateTransactionFlags } from "@/lib/queries";
import { CategorySourceBadge } from "./CategorySourceBadge";
import { SplitModal } from "./SplitModal";
import type { TransactionWithDetails, Category } from "@/types/database";

interface TransactionTableProps {
  transactions: TransactionWithDetails[];
  categories: Category[];
  onTransactionUpdate?: () => void;
}

export function TransactionTable({ transactions, categories, onTransactionUpdate }: TransactionTableProps) {
  const [splitModalTransaction, setSplitModalTransaction] = useState<TransactionWithDetails | null>(null);

  // Group transactions: parents with their children
  const groupedTransactions = useMemo(() => {
    // Build a map of parent -> children
    const childrenByParent: Record<string, TransactionWithDetails[]> = {};
    for (const t of transactions) {
      if (t.parent_transaction_id) {
        if (!childrenByParent[t.parent_transaction_id]) {
          childrenByParent[t.parent_transaction_id] = [];
        }
        childrenByParent[t.parent_transaction_id].push(t);
      }
    }

    // Return transactions that are not children (parents and standalone)
    // Children will be rendered inline under their parent
    const result: { transaction: TransactionWithDetails; children: TransactionWithDetails[] }[] = [];
    for (const t of transactions) {
      if (!t.is_split_child) {
        result.push({
          transaction: t,
          children: childrenByParent[t.id] || [],
        });
      }
    }
    return result;
  }, [transactions]);

  const handleUnsplit = async (parentId: string) => {
    try {
      const res = await fetch(`/api/transactions/split?parent_id=${parentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onTransactionUpdate?.();
      }
    } catch (error) {
      console.error("Failed to unsplit:", error);
    }
  };

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
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {groupedTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No transactions found matching your filters.
                </td>
              </tr>
            ) : (
              groupedTransactions.map(({ transaction, children }) => (
                <>
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    categories={categories}
                    onUpdate={onTransactionUpdate}
                    onSplit={() => setSplitModalTransaction(transaction)}
                    onUnsplit={() => handleUnsplit(transaction.id)}
                    isSplitParent={transaction.is_split_parent}
                  />
                  {children.map((child) => (
                    <TransactionRow
                      key={child.id}
                      transaction={child}
                      categories={categories}
                      onUpdate={onTransactionUpdate}
                      isChild
                    />
                  ))}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Split Modal */}
      {splitModalTransaction && (
        <SplitModal
          transaction={splitModalTransaction}
          categories={categories}
          isOpen={!!splitModalTransaction}
          onClose={() => setSplitModalTransaction(null)}
          onSplitComplete={() => {
            setSplitModalTransaction(null);
            onTransactionUpdate?.();
          }}
        />
      )}

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
  onSplit,
  onUnsplit,
  isSplitParent,
  isChild,
}: {
  transaction: TransactionWithDetails;
  categories: Category[];
  onUpdate?: () => void;
  onSplit?: () => void;
  onUnsplit?: () => void;
  isSplitParent?: boolean;
  isChild?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(transaction.life_category_id);
  const [saving, setSaving] = useState(false);
  const [localFlags, setLocalFlags] = useState({
    is_transfer: transaction.is_transfer,
    is_pass_through: transaction.is_pass_through,
    is_business: transaction.is_business,
  });

  const isIncome = transaction.amount >= 0;

  const handleFlagToggle = async (flag: 'is_transfer' | 'is_pass_through' | 'is_business') => {
    const newValue = !localFlags[flag];
    setLocalFlags(prev => ({ ...prev, [flag]: newValue }));
    try {
      await updateTransactionFlags(transaction.id, { [flag]: newValue });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update flag:", error);
      setLocalFlags(prev => ({ ...prev, [flag]: !newValue }));
    }
  };

  const handleCategoryChange = async (newCategoryId: string) => {
    setSelectedCategory(newCategoryId);
    setSaving(true);
    try {
      // Use the override API which also sets category_locked and learns payee
      const res = await fetch(`/api/transactions/${transaction.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: newCategoryId, learn_payee: true }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update category");
      }
      
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update category:", error);
      // Revert on error
      setSelectedCategory(transaction.life_category_id);
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  return (
    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
      isChild ? "bg-slate-50/50 dark:bg-slate-900/50" : ""
    } ${isSplitParent ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
      {/* Date */}
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {new Date(transaction.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </td>

      {/* Description */}
      <td className="px-4 py-3">
        <div className={`text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2 ${
          isChild ? "pl-4" : ""
        }`}>
          {isChild && (
            <span className="text-slate-400 dark:text-slate-500">↳</span>
          )}
          {isSplitParent && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded" title="Split parent - excluded from totals">
              SPLIT
            </span>
          )}
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              {transaction.category_name || "Uncategorized"}
              {transaction.category_locked && (
                <span className="text-xs" title="Manually set">🔒</span>
              )}
            </button>
            <CategorySourceBadge 
              source={transaction.category_source} 
              confidence={transaction.category_ai_conf ? transaction.category_ai_conf / 100 : null} 
            />
          </div>
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

      {/* Flags (Clickable Toggles) */}
      <td className="px-4 py-3">
        <div className="flex justify-center gap-1">
          <button
            onClick={() => handleFlagToggle('is_transfer')}
            className={`px-1.5 py-0.5 text-xs rounded cursor-pointer transition-colors ${
              localFlags.is_transfer
                ? "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            title={localFlags.is_transfer ? "Transfer (click to remove)" : "Mark as Transfer"}
          >
            T
          </button>
          <button
            onClick={() => handleFlagToggle('is_pass_through')}
            className={`px-1.5 py-0.5 text-xs rounded cursor-pointer transition-colors ${
              localFlags.is_pass_through
                ? "bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200"
                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-amber-100 dark:hover:bg-amber-900"
            }`}
            title={localFlags.is_pass_through ? "Pass-Through (click to remove)" : "Mark as Pass-Through"}
          >
            P
          </button>
          <button
            onClick={() => handleFlagToggle('is_business')}
            className={`px-1.5 py-0.5 text-xs rounded cursor-pointer transition-colors ${
              localFlags.is_business
                ? "bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200"
                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-blue-900"
            }`}
            title={localFlags.is_business ? "Business (click to remove)" : "Mark as Business"}
          >
            B
          </button>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex justify-center gap-1">
          {!isChild && !isSplitParent && (
            <button
              onClick={onSplit}
              className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              title="Split transaction into multiple categories"
            >
              Split
            </button>
          )}
          {isSplitParent && (
            <button
              onClick={onUnsplit}
              className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              title="Remove splits and restore original transaction"
            >
              Unsplit
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
