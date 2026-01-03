"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/cashflow";
import { getBudgetSummary } from "@/lib/queries";
import type { BudgetSummary, CashflowGroup } from "@/types/database";

interface BudgetTableProps {
  month: string; // YYYY-MM format
}

const GROUP_ORDER: CashflowGroup[] = [
  "Income",
  "Fixed",
  "Variable Essentials",
  "Discretionary",
  "Debt",
  "Savings/Investing",
];

export function BudgetTable({ month }: BudgetTableProps) {
  const [loading, setLoading] = useState(true);
  const [budgetData, setBudgetData] = useState<BudgetSummary[]>([]);

  useEffect(() => {
    async function fetchBudgetData() {
      setLoading(true);
      try {
        const { categories, targets, actuals, actualsByCashflowGroup } = await getBudgetSummary(month);

        // Build a map of category_id -> actual spending
        const actualsMap: Record<string, number> = {};
        for (const a of actuals) {
          actualsMap[a.category_id] = a.total;
        }

        // Build a map of cashflow_group -> actual spending (fallback)
        const cashflowGroupActualsMap: Record<string, number> = {};
        for (const a of actualsByCashflowGroup) {
          cashflowGroupActualsMap[a.cashflow_group] = a.total;
        }

        // Build a map of category_id -> budget target
        const targetsMap: Record<string, number> = {};
        for (const t of targets) {
          targetsMap[t.category_id] = t.amount;
        }

        // Build budget summary for each category that has a target
        const summaries: BudgetSummary[] = [];

        for (const cat of categories) {
          const expected = targetsMap[cat.id] || 0;
          // Skip categories with no budget target
          if (expected === 0) continue;

          // Get actual from direct category match, or fallback to 0
          const actual = actualsMap[cat.id] || 0;
          const variance = actual - expected;
          const percentUsed = expected > 0 ? Math.round((actual / expected) * 100) : 0;

          summaries.push({
            categoryId: cat.id,
            categoryName: cat.name,
            cashflowGroup: cat.cashflow_group,
            expected,
            actual,
            variance,
            percentUsed,
          });
        }

        setBudgetData(summaries);
      } catch (error) {
        console.error("Error fetching budget data:", error);
        setBudgetData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBudgetData();
  }, [month]);

  // Group data by cashflow group
  const groupedData = GROUP_ORDER.map((group) => ({
    group,
    items: budgetData.filter((d) => d.cashflowGroup === group),
  })).filter((g) => g.items.length > 0);

  // Calculate totals from real data
  const totals = {
    income: { expected: 0, actual: 0 },
    expenses: { expected: 0, actual: 0 },
  };

  budgetData.forEach((d) => {
    if (d.cashflowGroup === "Income") {
      totals.income.expected += d.expected;
      totals.income.actual += d.actual;
    } else {
      totals.expenses.expected += d.expected;
      totals.expenses.actual += d.actual;
    }
  });

  const netExpected = totals.income.expected - totals.expenses.expected;
  const netActual = totals.income.actual - totals.expenses.actual;

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
          Loading budget data...
        </div>
      </div>
    );
  }

  // Show empty state if no budget targets
  if (budgetData.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          No budget targets found for this month.
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
          Add budget targets in Supabase to see your budget vs actuals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Income"
          expected={totals.income.expected}
          actual={totals.income.actual}
          isIncome
        />
        <SummaryCard
          title="Total Expenses"
          expected={totals.expenses.expected}
          actual={totals.expenses.actual}
        />
        <SummaryCard
          title="Net Planned"
          expected={netExpected}
          actual={netActual}
          isNet
        />
      </div>

      {/* Category Tables by Group */}
      {groupedData.map(({ group, items }) => (
        <div key={group} className="card overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">{group}</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Expected</th>
                <th className="px-4 py-3 text-right">Actual</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 w-32">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {items.map((item) => (
                <BudgetRow key={item.categoryId} item={item} isIncome={group === "Income"} />
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-800">
              <tr className="font-medium">
                <td className="px-4 py-3 text-slate-900 dark:text-white">Subtotal</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatCurrency(items.reduce((s, i) => s + i.expected, 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatCurrency(items.reduce((s, i) => s + i.actual, 0))}
                </td>
                <td className="px-4 py-3 text-right">
                  <VarianceCell variance={items.reduce((s, i) => s + i.variance, 0)} isIncome={group === "Income"} />
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  title,
  expected,
  actual,
  isIncome = false,
  isNet = false,
}: {
  title: string;
  expected: number;
  actual: number;
  isIncome?: boolean;
  isNet?: boolean;
}) {
  const variance = actual - expected;
  const isPositive = isNet ? actual >= 0 : isIncome ? actual >= expected : actual <= expected;

  return (
    <div className="card p-4">
      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">{title}</h4>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(actual)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            of {formatCurrency(expected)} planned
          </p>
        </div>
        <span
          className={`text-sm font-medium ${
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {variance >= 0 ? "+" : ""}
          {formatCurrency(variance)}
        </span>
      </div>
    </div>
  );
}

function BudgetRow({ item, isIncome }: { item: BudgetSummary; isIncome: boolean }) {
  // For expenses, over budget is bad (red). For income, under expected is bad.
  const isOverBudget = isIncome ? item.actual < item.expected : item.actual > item.expected;
  const progressColor = isOverBudget
    ? "bg-red-500"
    : item.percentUsed > 80
    ? "bg-yellow-500"
    : "bg-green-500";

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
        {item.categoryName}
      </td>
      <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
        {formatCurrency(item.expected)}
      </td>
      <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-white font-medium">
        {formatCurrency(item.actual)}
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <VarianceCell variance={item.variance} isIncome={isIncome} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor}`}
              style={{ width: `${Math.min(item.percentUsed, 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right">
            {item.percentUsed}%
          </span>
        </div>
      </td>
    </tr>
  );
}

function VarianceCell({ variance, isIncome }: { variance: number; isIncome: boolean }) {
  // For income: positive variance (actual > expected) is good
  // For expenses: negative variance (actual < expected) is good
  const isGood = isIncome ? variance >= 0 : variance <= 0;

  return (
    <span
      className={`text-sm font-medium ${
        isGood ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {variance >= 0 ? "+" : ""}
      {formatCurrency(variance)}
    </span>
  );
}
