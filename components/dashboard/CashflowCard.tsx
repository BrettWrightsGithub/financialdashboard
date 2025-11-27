"use client";

import { formatCurrency, formatMonth } from "@/lib/cashflow";

interface CashflowCardProps {
  currentMonth: string;
  income: number;
  expenses: number;
  netCashflow: number;
}

export function CashflowCard({
  currentMonth,
  income,
  expenses,
  netCashflow,
}: CashflowCardProps) {
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

    </div>
  );
}
