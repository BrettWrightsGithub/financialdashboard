"use client";

import type { Account, CashflowGroup } from "@/types/database";

export interface GlobalFilterState {
  dateRange: { start: string; end: string };
  accountId: string | null;
  cashflowGroup: CashflowGroup | null;
  hideTransfers: boolean;
  hidePassThrough: boolean;
  searchQuery: string;
}

interface GlobalFiltersProps {
  filters: GlobalFilterState;
  onChange: (next: GlobalFilterState) => void;
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
  "Other",
];

export function GlobalFilters({ filters, onChange, accounts }: GlobalFiltersProps) {
  const update = <K extends keyof GlobalFilterState>(key: K, value: GlobalFilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <input
          type="search"
          value={filters.searchQuery}
          onChange={(event) => update("searchQuery", event.target.value)}
          placeholder="Search description"
          className="input md:col-span-2"
        />

        <input
          type="date"
          value={filters.dateRange.start}
          onChange={(event) => onChange({ ...filters, dateRange: { ...filters.dateRange, start: event.target.value } })}
          className="input"
        />

        <input
          type="date"
          value={filters.dateRange.end}
          onChange={(event) => onChange({ ...filters, dateRange: { ...filters.dateRange, end: event.target.value } })}
          className="input"
        />

        <select
          value={filters.accountId || ""}
          onChange={(event) => update("accountId", event.target.value || null)}
          className="select"
        >
          <option value="">All Accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.display_name || account.name}</option>
          ))}
        </select>

        <select
          value={filters.cashflowGroup || ""}
          onChange={(event) => update("cashflowGroup", (event.target.value || null) as CashflowGroup | null)}
          className="select"
        >
          <option value="">All Groups</option>
          {CASHFLOW_GROUPS.map((group) => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
        <label className="inline-flex items-center gap-2 min-h-[44px]">
          <input
            type="checkbox"
            checked={filters.hideTransfers}
            onChange={(event) => update("hideTransfers", event.target.checked)}
          />
          Hide transfers
        </label>

        <label className="inline-flex items-center gap-2 min-h-[44px]">
          <input
            type="checkbox"
            checked={filters.hidePassThrough}
            onChange={(event) => update("hidePassThrough", event.target.checked)}
          />
          Hide pass-through
        </label>
      </div>
    </div>
  );
}
