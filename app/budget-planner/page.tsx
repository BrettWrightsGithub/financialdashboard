"use client";

import { useState } from "react";
import { BudgetTable } from "@/components/budget/BudgetTable";
import { MonthSelector } from "@/components/budget/MonthSelector";

export default function BudgetPlannerPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Budget Planner</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Compare expected vs actual spending by category
          </p>
        </div>
        <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Budget Table */}
      <BudgetTable month={selectedMonth} />
    </div>
  );
}
