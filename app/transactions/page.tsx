"use client";

import { useState, useEffect, useCallback } from "react";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { getTransactions, getCategories, getAccounts } from "@/lib/queries";
import type { TransactionFilters as FilterType, TransactionWithDetails, Category, Account } from "@/types/database";

export default function TransactionsPage() {
  const [filters, setFilters] = useState<FilterType>({
    dateRange: {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    },
    accountId: null,
    cashflowGroup: null,
    hideTransfers: false,
    hidePassThrough: false,
  });

  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTransactions({
        startDate: filters.dateRange.start,
        endDate: filters.dateRange.end,
        accountId: filters.accountId || undefined,
        cashflowGroup: filters.cashflowGroup || undefined,
        hideTransfers: filters.hideTransfers,
        hidePassThrough: filters.hidePassThrough,
      });
      setTransactions(data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // Fetch categories and accounts once on mount
    async function fetchStaticData() {
      const [cats, accts] = await Promise.all([getCategories(), getAccounts()]);
      setCategories(cats);
      setAccounts(accts);
    }
    fetchStaticData();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          View and manage all your transactions
        </p>
      </div>

      {/* Filters */}
      <TransactionFilters
        filters={filters}
        onFiltersChange={setFilters}
        accounts={accounts}
      />

      {/* Transaction Table */}
      {loading ? (
        <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
          Loading transactions...
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          categories={categories}
          onTransactionUpdate={fetchTransactions}
        />
      )}
    </div>
  );
}
