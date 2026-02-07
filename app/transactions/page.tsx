"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlobalFilters, type GlobalFilterState } from "@/components/transactions/GlobalFilters";
import { ReviewQueue } from "@/components/transactions/ReviewQueue";
import { TransactionLedger } from "@/components/transactions/TransactionLedger";
import { ChatAssistant } from "@/components/assistant/ChatAssistant";
import { getAccounts, getCategories, getTransactions } from "@/lib/queries";
import type { Account, Category, TransactionWithDetails } from "@/types/database";

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<GlobalFilterState>({
    dateRange: defaultDateRange(),
    accountId: null,
    cashflowGroup: null,
    hideTransfers: true,
    hidePassThrough: false,
    searchQuery: "",
  });

  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const data = await getTransactions({
      startDate: filters.dateRange.start,
      endDate: filters.dateRange.end,
      accountId: filters.accountId || undefined,
      cashflowGroup: filters.cashflowGroup || undefined,
      hideTransfers: filters.hideTransfers,
      hidePassThrough: filters.hidePassThrough,
      searchQuery: filters.searchQuery || undefined,
    });
    setTransactions(data);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    Promise.all([getCategories(), getAccounts()]).then(([categoryData, accountData]) => {
      setCategories(categoryData);
      setAccounts(accountData);
    });
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const selectedTransactions = useMemo(
    () => transactions.filter((transaction) => selectedIds.has(transaction.id)),
    [selectedIds, transactions]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Unified review queue and transaction ledger</p>
      </div>

      <GlobalFilters filters={filters} onChange={setFilters} accounts={accounts} />

      <ReviewQueue
        filters={filters}
        categories={categories}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onSelectTransaction={setSelectedTransaction}
      />

      {loading ? (
        <div className="card p-8 text-center text-slate-500">Loading transactions…</div>
      ) : (
        <TransactionLedger
          transactions={transactions}
          categories={categories}
          filters={filters}
          onTransactionUpdate={fetchTransactions}
        />
      )}

      <ChatAssistant selectedTransaction={selectedTransaction || selectedTransactions[0] || null} />
    </div>
  );
}
