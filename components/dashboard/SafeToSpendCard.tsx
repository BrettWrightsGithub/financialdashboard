"use client";

import { formatCurrency } from "@/lib/cashflow";

// TODO: Replace with real data from Supabase
const MOCK_DATA = {
  safeToSpend: 342,
  weeklyTarget: 500,
  spentThisWeek: 158,
};

export function SafeToSpendCard() {
  const { safeToSpend, weeklyTarget, spentThisWeek } = MOCK_DATA;
  const percentUsed = (spentThisWeek / weeklyTarget) * 100;
  const isOverBudget = safeToSpend < 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Safe to Spend This Week
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-500">
          Mon – Sun
        </span>
      </div>

      {/* Main Number */}
      <div className="mb-4">
        <span
          className={`text-4xl font-bold ${
            isOverBudget
              ? "text-red-600 dark:text-red-400"
              : "text-green-600 dark:text-green-400"
          }`}
        >
          {formatCurrency(safeToSpend)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              percentUsed > 100
                ? "bg-red-500"
                : percentUsed > 80
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Spent: {formatCurrency(spentThisWeek)}</span>
          <span>Target: {formatCurrency(weeklyTarget)}</span>
        </div>
      </div>
    </div>
  );
}
