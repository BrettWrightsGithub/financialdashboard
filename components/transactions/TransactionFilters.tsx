"use client";

import type { TransactionFilters as FilterType, CashflowGroup, Account } from "@/types/database";

interface TransactionFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  accounts: Account[];
}

const CASHFLOW_GROUPS: CashflowGroup[] = [
  "Income",
  "Fixed",
  "Variable Essentials",
  "Discretionary",
  "Debt",
  "Savings/Investing",
  "Business",
  "Transfer",
];

export function TransactionFilters({ filters, onFiltersChange, accounts }: TransactionFiltersProps) {
  const updateFilter = <K extends keyof FilterType>(key: K, value: FilterType[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const updateDateRange = (field: "start" | "end", value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: { ...filters.dateRange, [field]: value },
    });
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Search
          </label>
          <input
            type="text"
            value={filters.searchQuery || ""}
            onChange={(e) => updateFilter("searchQuery", e.target.value)}
            placeholder="Search description..."
            className="input text-sm min-w-[180px]"
          />
        </div>

        {/* Date Range */}
        <div className="flex gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => updateDateRange("start", e.target.value)}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => updateDateRange("end", e.target.value)}
              className="input text-sm"
            />
          </div>
        </div>

        {/* Account Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Account
          </label>
          <select
            value={filters.accountId || ""}
            onChange={(e) => updateFilter("accountId", e.target.value || null)}
            className="select text-sm min-w-[150px]"
          >
            <option value="">All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Cashflow Group Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Cashflow Group
          </label>
          <select
            value={filters.cashflowGroup || ""}
            onChange={(e) => updateFilter("cashflowGroup", (e.target.value as CashflowGroup) || null)}
            className="select text-sm min-w-[150px]"
          >
            <option value="">All Groups</option>
            {CASHFLOW_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle Filters */}
        <div className="flex items-center gap-4 ml-auto">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hideTransfers}
              onChange={(e) => updateFilter("hideTransfers", e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Hide Transfers
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hidePassThrough}
              onChange={(e) => updateFilter("hidePassThrough", e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Hide Pass-Through
          </label>
        </div>
      </div>
    </div>
  );
}
