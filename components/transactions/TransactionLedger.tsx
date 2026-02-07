"use client";

import { useMemo } from "react";
import { TransactionTable } from "./TransactionTable";
import { TransactionCard } from "./TransactionCard";
import { SplitTransactionTree } from "./SplitTransactionTree";
import type { Category, TransactionWithDetails } from "@/types/database";
import type { GlobalFilterState } from "./GlobalFilters";

interface TransactionLedgerProps {
  transactions: TransactionWithDetails[];
  categories: Category[];
  filters: GlobalFilterState;
  onTransactionUpdate: () => void;
}

function applyFilters(transactions: TransactionWithDetails[], filters: GlobalFilterState): TransactionWithDetails[] {
  const search = filters.searchQuery.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (filters.accountId && transaction.account_id !== filters.accountId) return false;
    if (filters.cashflowGroup && transaction.cashflow_group !== filters.cashflowGroup) return false;
    if (filters.hideTransfers && transaction.is_transfer) return false;
    if (filters.hidePassThrough && transaction.is_pass_through) return false;
    if (transaction.date < filters.dateRange.start || transaction.date > filters.dateRange.end) return false;

    if (search) {
      const blob = `${transaction.description_raw} ${transaction.description_clean || ""} ${transaction.category_name || ""}`.toLowerCase();
      if (!blob.includes(search)) return false;
    }

    return true;
  });
}

export function TransactionLedger({ transactions, categories, filters, onTransactionUpdate }: TransactionLedgerProps) {
  const filtered = useMemo(() => applyFilters(transactions, filters), [transactions, filters]);

  const grouped = useMemo(() => {
    const parents = filtered.filter((transaction) => transaction.is_split_parent);
    const childrenByParent = new Map<string, TransactionWithDetails[]>();

    filtered
      .filter((transaction) => transaction.is_split_child && transaction.parent_transaction_id)
      .forEach((child) => {
        const parentId = child.parent_transaction_id as string;
        const list = childrenByParent.get(parentId) || [];
        list.push(child);
        childrenByParent.set(parentId, list);
      });

    return parents.map((parent) => ({ parent, children: childrenByParent.get(parent.id) || [] }));
  }, [filtered]);

  return (
    <section className="space-y-3">
      <div className="hidden md:block">
        <TransactionTable transactions={filtered} categories={categories} onTransactionUpdate={onTransactionUpdate} />
      </div>

      <div className="md:hidden space-y-3">
        {filtered.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            categories={categories}
            onUpdated={onTransactionUpdate}
          />
        ))}
      </div>

      {grouped.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Split Transaction Tree</div>
          {grouped.map(({ parent, children }) => (
            <SplitTransactionTree
              key={parent.id}
              parent={parent}
              childTransactions={children}
              onDeleteChild={async (childId) => {
                const response = await fetch("/api/transactions/split-children", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ child_id: childId }),
                });
                if (response.ok) {
                  onTransactionUpdate();
                }
              }}
              onEditParent={(parentId) => {
                if (window.confirm("Editing the parent may invalidate child totals. Continue?")) {
                  window.dispatchEvent(new CustomEvent("select-transaction", { detail: { id: parentId } }));
                }
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
