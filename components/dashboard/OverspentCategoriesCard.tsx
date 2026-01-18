"use client";

import { formatCurrency } from "@/lib/cashflow";

interface OverspentCategory {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  overspent: number;
}

interface OverspentCategoriesCardProps {
  categories: OverspentCategory[];
}

export function OverspentCategoriesCard({ categories }: OverspentCategoriesCardProps) {
  if (categories.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
          Overspent Categories
        </h2>
        <div className="text-center py-4">
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            All categories within budget! 🎉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
        Top Overspent Categories
      </h2>

      <div className="space-y-4">
        {categories.map((cat) => {
          const percentOver = ((cat.actual - cat.budgeted) / cat.budgeted) * 100;

          return (
            <div key={cat.categoryId} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {cat.categoryName}
                </span>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  +{formatCurrency(cat.overspent)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {formatCurrency(cat.actual)} / {formatCurrency(cat.budgeted)}
                </span>
                <span className="text-red-600 dark:text-red-400">
                  {percentOver.toFixed(0)}% over
                </span>
              </div>

              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 dark:bg-red-600 rounded-full"
                  style={{ width: `${Math.min((cat.actual / cat.budgeted) * 100, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
