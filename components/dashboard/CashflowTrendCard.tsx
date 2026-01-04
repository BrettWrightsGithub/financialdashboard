"use client";

import { formatCurrency } from "@/lib/cashflow";

interface CashflowTrendCardProps {
  trend: { month: string; net: number }[];
}

export function CashflowTrendCard({ trend }: CashflowTrendCardProps) {
  if (trend.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
          Cashflow Trend
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">No data available</p>
      </div>
    );
  }

  const maxAbsValue = Math.max(...trend.map((d) => Math.abs(d.net)));
  const chartHeight = 60;

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
        Cashflow Trend (Last {trend.length} Months)
      </h2>

      <div className="flex items-end justify-between gap-1 mb-3" style={{ height: chartHeight }}>
        {trend.map((point, idx) => {
          const barHeight = maxAbsValue > 0 ? (Math.abs(point.net) / maxAbsValue) * chartHeight : 0;
          const isPositive = point.net >= 0;
          const isLast = idx === trend.length - 1;

          return (
            <div
              key={point.month}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              <div
                className={`w-full rounded-t transition-all ${
                  isLast
                    ? isPositive
                      ? "bg-green-600 dark:bg-green-500"
                      : "bg-red-600 dark:bg-red-500"
                    : isPositive
                    ? "bg-green-400 dark:bg-green-600"
                    : "bg-red-400 dark:bg-red-600"
                }`}
                style={{ height: `${barHeight}px` }}
              />
              
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 dark:bg-slate-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                {new Date(point.month + "-01").toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
                : {formatCurrency(point.net)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
        <span>
          {new Date(trend[0].month + "-01").toLocaleDateString("en-US", {
            month: "short",
          })}
        </span>
        <span>
          {new Date(trend[trend.length - 1].month + "-01").toLocaleDateString("en-US", {
            month: "short",
          })}
        </span>
      </div>

      <div className="mt-3 text-center">
        <span className="text-xs text-slate-500 dark:text-slate-400">Current: </span>
        <span
          className={`text-sm font-semibold ${
            trend[trend.length - 1].net >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {formatCurrency(trend[trend.length - 1].net)}
        </span>
      </div>
    </div>
  );
}
