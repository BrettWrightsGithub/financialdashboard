"use client";

import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/cashflow";

// TODO: Replace with real data from Supabase
const MOCK_DATA = {
  currentMonth: getCurrentMonth(),
  income: 8500,
  expenses: 7200,
  netCashflow: 1300,
  // Last 3 months for sparkline
  history: [
    { month: "2025-09", net: 850 },
    { month: "2025-10", net: -200 },
    { month: "2025-11", net: 1300 },
  ],
};

export function CashflowCard() {
  const { currentMonth, income, expenses, netCashflow, history } = MOCK_DATA;
  const isPositive = netCashflow >= 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Monthly Cashflow
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-500">
          {formatMonth(currentMonth)}
        </span>
      </div>

      {/* Net Cashflow */}
      <div className="mb-4">
        <span
          className={`text-3xl font-bold ${
            isPositive
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {formatCurrency(netCashflow)}
        </span>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isPositive ? "Surplus" : "Deficit"} this month
        </p>
      </div>

      {/* Income vs Expenses */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Income</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatCurrency(income)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Expenses</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatCurrency(expenses)}
          </p>
        </div>
      </div>

      {/* Mini Sparkline (simplified) */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Last 3 months
        </p>
        <div className="flex items-end gap-1 h-8">
          {history.map((h, i) => {
            const maxAbs = Math.max(...history.map((x) => Math.abs(x.net)));
            const heightPercent = Math.abs(h.net) / maxAbs;
            return (
              <div
                key={h.month}
                className="flex-1 flex flex-col justify-end"
              >
                <div
                  className={`rounded-sm ${
                    h.net >= 0 ? "bg-green-400" : "bg-red-400"
                  }`}
                  style={{ height: `${heightPercent * 100}%`, minHeight: "4px" }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
