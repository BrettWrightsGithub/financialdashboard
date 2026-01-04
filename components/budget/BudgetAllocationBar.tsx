"use client";

import { formatCurrency } from "@/lib/cashflow";

interface BudgetAllocationBarProps {
  totalIncome: number;
  totalAllocated: number;
  className?: string;
}

export function BudgetAllocationBar({
  totalIncome,
  totalAllocated,
  className = "",
}: BudgetAllocationBarProps) {
  const remaining = totalIncome - totalAllocated;
  const allocatedPercentage = totalIncome > 0 ? (totalAllocated / totalIncome) * 100 : 0;
  const remainingPercentage = totalIncome > 0 ? (remaining / totalIncome) * 100 : 0;

  // Determine color coding
  const getStatusColor = () => {
    if (remaining < 0) {
      return {
        bg: "bg-red-500",
        text: "text-red-600 dark:text-red-400",
        label: "Over Budget",
      };
    } else if (remaining < totalIncome * 0.1) {
      return {
        bg: "bg-yellow-500",
        text: "text-yellow-600 dark:text-yellow-400",
        label: "Low Remaining",
      };
    } else {
      return {
        bg: "bg-green-500",
        text: "text-green-600 dark:text-green-400",
        label: "On Track",
      };
    }
  };

  const status = getStatusColor();

  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Budget Allocation
        </h3>
        <span className={`text-xs font-medium ${status.text}`}>
          {status.label}
        </span>
      </div>

      {/* Summary Numbers */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Total Income
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Allocated
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalAllocated)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Remaining
          </p>
          <p className={`text-lg font-bold ${status.text}`}>
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{allocatedPercentage.toFixed(1)}% Allocated</span>
          <span>{remainingPercentage.toFixed(1)}% Available</span>
        </div>
        
        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            {/* Allocated portion */}
            <div
              className={status.bg}
              style={{ width: `${Math.min(allocatedPercentage, 100)}%` }}
            />
            {/* Remaining portion */}
            <div
              className="bg-slate-200 dark:bg-slate-600"
              style={{ width: `${Math.max(remainingPercentage, 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Warning for over budget */}
      {remaining < 0 && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-xs text-red-700 dark:text-red-300">
            ⚠️ You've allocated {formatCurrency(Math.abs(remaining))} more than your income.
            Consider reducing some budget categories.
          </p>
        </div>
      )}

      {/* Warning for low remaining */}
      {remaining >= 0 && remaining < totalIncome * 0.1 && totalIncome > 0 && (
        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            ⚠️ You only have {formatCurrency(remaining)} remaining ({remainingPercentage.toFixed(1)}%).
            Consider building a buffer for unexpected expenses.
          </p>
        </div>
      )}

      {/* Good status */}
      {remaining >= totalIncome * 0.1 && totalIncome > 0 && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
          <p className="text-xs text-green-700 dark:text-green-300">
            ✅ You have {formatCurrency(remaining)} remaining ({remainingPercentage.toFixed(1)}%).
            This gives you flexibility for unexpected expenses.
          </p>
        </div>
      )}
    </div>
  );
}
