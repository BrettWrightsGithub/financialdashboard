"use client";

import { useState } from "react";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import type { TransactionFilters as FilterType } from "@/types/database";

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
      <TransactionFilters filters={filters} onFiltersChange={setFilters} />

      {/* Transaction Table */}
      <TransactionTable filters={filters} />
    </div>
  );
}
