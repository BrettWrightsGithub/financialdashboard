"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/cashflow";
import { getBudgetSummary, getActualsByCategory, getThreeMonthAverage, upsertBudgetTarget, deleteBudgetTarget } from "@/lib/queries";
import { InlineEditCell } from "./InlineEditCell";
import { AddCategoryDropdown } from "./AddCategoryDropdown";
import type { BudgetSummary, CashflowGroup, Category } from "@/types/database";

interface BudgetTableProps {
  month: string; // YYYY-MM format
  categories?: Category[];
  onCategoryAdd?: (category: Category) => Promise<void>;
  onResetToActuals?: () => Promise<void>;
}

const GROUP_ORDER: CashflowGroup[] = [
  "Income",
  "Fixed",
  "Variable Essentials",
  "Discretionary",
  "Debt",
  "Savings/Investing",
];

export function BudgetTable({ month, categories = [], onCategoryAdd, onResetToActuals }: BudgetTableProps) {
  const [loading, setLoading] = useState(true);
  const [budgetData, setBudgetData] = useState<BudgetSummary[]>([]);
  const [lastMonthActuals, setLastMonthActuals] = useState<Record<string, number>>({});
  const [threeMonthAverages, setThreeMonthAverages] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchBudgetData() {
      setLoading(true);
      try {
        const [summary, lastMonth, threeMonth] = await Promise.all([
          getBudgetSummary(month),
          getActualsByCategory(getPreviousMonth(month)),
          getThreeMonthAverage(month)
        ]);

        // Build a map of category_id -> actual spending
        const actualsMap: Record<string, number> = {};
        for (const a of summary.actuals) {
          actualsMap[a.category_id] = a.total;
        }

        // Build a map of cashflow_group -> actual spending (fallback)
        const cashflowGroupActualsMap: Record<string, number> = {};
        for (const a of summary.actualsByCashflowGroup) {
          cashflowGroupActualsMap[a.cashflow_group] = a.total;
        }

        // Build a map of category_id -> budget target
        const targetsMap: Record<string, number> = {};
        for (const t of summary.targets) {
          targetsMap[t.category_id] = t.amount;
        }

        // Build maps for historical data
        const lastMonthMap: Record<string, number> = {};
        for (const actual of lastMonth) {
          lastMonthMap[actual.category_id] = actual.total;
        }

        const threeMonthMap: Record<string, number> = {};
        for (const avg of threeMonth) {
          threeMonthMap[avg.category_id] = avg.average;
        }

        setLastMonthActuals(lastMonthMap);
        setThreeMonthAverages(threeMonthMap);

        // Build budget summary for each category that has a target
        const summaries: BudgetSummary[] = [];

        for (const cat of summary.categories) {
          const expected = targetsMap[cat.id] || 0;
          // Skip categories with no budget target
          if (expected === 0) continue;

          // Get actual from direct category match (signed sum from backend)
          const actualSigned = actualsMap[cat.id] || 0;
          
          // For display: Income stays positive, expenses use absolute value
          // Note: Refunds are positive amounts in expense categories, so Math.abs() correctly reduces spending
          const isIncome = cat.cashflow_group === "Income";
          const actual = isIncome ? actualSigned : Math.abs(actualSigned);
          const expectedAbs = Math.abs(expected);
          
          // Variance calculation depends on category type
          // For expenses: negative actual (after abs) means less spent = good
          // For income: positive actual means more earned = good
          const variance = isIncome ? actual - expectedAbs : expectedAbs - actual;
          const percentUsed = expectedAbs > 0 ? Math.round((actual / expectedAbs) * 100) : 0;

          summaries.push({
            categoryId: cat.id,
            categoryName: cat.name,
            cashflowGroup: cat.cashflow_group,
            expected: expectedAbs,
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

  // Helper function to get previous month
  function getPreviousMonth(currentMonth: string): string {
    const [year, month] = currentMonth.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  }

  // Handle budget amount updates
  const handleBudgetUpdate = async (categoryId: string, newAmount: number) => {
    try {
      await upsertBudgetTarget(categoryId, month, newAmount);
      
      // Update local state
      setBudgetData(prev => 
        prev.map(item => 
          item.categoryId === categoryId 
            ? { ...item, expected: newAmount }
            : item
        )
      );
    } catch (error) {
      console.error("Error updating budget:", error);
      throw error;
    }
  };

  // Handle category removal
  const handleCategoryRemove = async (categoryId: string) => {
    if (!confirm("Are you sure you want to remove this category from the budget?")) {
      return;
    }

    try {
      // Find the budget target to delete
      const response = await fetch(`/api/budget-targets?month=${month}`);
      const { data } = await response.json();
      const targetToDelete = data.find((t: any) => t.category_id === categoryId);
      
      if (targetToDelete) {
        await deleteBudgetTarget(targetToDelete.id);
        
        // Update local state
        setBudgetData(prev => prev.filter(item => item.categoryId !== categoryId));
      }
    } catch (error) {
      console.error("Error removing category:", error);
    }
  };

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
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Budget Targets</h2>
        <div className="flex gap-3">
          {onResetToActuals && (
            <button
              onClick={onResetToActuals}
              className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                       hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md
                       transition-colors duration-150 ease-in-out"
            >
              Reset to Actuals
            </button>
          )}
          {onCategoryAdd && (
            <AddCategoryDropdown 
              month={month} 
              existingCategoryIds={budgetData.map(item => item.categoryId)}
              onCategoryAdd={onCategoryAdd}
            />
          )}
        </div>
      </div>

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
                <th className="px-4 py-3 text-right">Last Month</th>
                <th className="px-4 py-3 text-right">3-Mo Avg</th>
                <th className="px-4 py-3 text-right">Expected</th>
                <th className="px-4 py-3 text-right">Actual</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 w-32">Progress</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {items.map((item, index) => (
                <BudgetRow 
                  key={item.categoryId} 
                  item={item} 
                  isIncome={group === "Income"}
                  lastMonthActual={lastMonthActuals[item.categoryId] || 0}
                  threeMonthAverage={threeMonthAverages[item.categoryId] || 0}
                  onBudgetUpdate={(amount) => handleBudgetUpdate(item.categoryId, amount)}
                  onRemove={() => handleCategoryRemove(item.categoryId)}
                  testId={`budget-amount-${index}`}
                />
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-800">
              <tr className="font-medium">
                <td className="px-4 py-3 text-slate-900 dark:text-white">Subtotal</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                  {formatCurrency(items.reduce((s, i) => s + (lastMonthActuals[i.categoryId] || 0), 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                  {formatCurrency(items.reduce((s, i) => s + (threeMonthAverages[i.categoryId] || 0), 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatCurrency(items.reduce((s, i) => s + i.expected, 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatCurrency(items.reduce((s, i) => s + i.actual, 0))}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-medium ${
                    group === "Income" 
                      ? items.reduce((s, i) => s + (i.expected - i.actual), 0) >= 0 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                      : items.reduce((s, i) => s + (i.expected - i.actual), 0) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                  }`}>
                    {formatCurrency(items.reduce((s, i) => s + (i.expected - i.actual), 0))}
                  </span>
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

function BudgetRow({ 
  item, 
  isIncome, 
  lastMonthActual, 
  threeMonthAverage, 
  onBudgetUpdate, 
  onRemove,
  testId 
}: { 
  item: BudgetSummary; 
  isIncome: boolean;
  lastMonthActual: number;
  threeMonthAverage: number;
  onBudgetUpdate: (amount: number) => Promise<void>;
  onRemove: () => void;
  testId?: string;
}) {
  // For expenses, over budget is bad (red). For income, under expected is bad.
  const isOverBudget = isIncome ? item.actual < item.expected : item.actual > item.expected;
  const progressColor = isOverBudget
    ? "bg-red-500"
    : item.percentUsed > 80
    ? "bg-yellow-500"
    : "bg-green-500";

  const remaining = item.expected - item.actual;

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
        {item.categoryName}
      </td>
      <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
        {formatCurrency(isIncome ? lastMonthActual : Math.abs(lastMonthActual))}
      </td>
      <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
        {formatCurrency(threeMonthAverage)}
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <InlineEditCell
          value={item.expected}
          onSave={onBudgetUpdate}
          testId={testId}
        />
      </td>
      <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-white font-medium">
        {formatCurrency(item.actual)}
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <span className={`text-sm font-medium ${
          isIncome 
            ? remaining >= 0 
              ? "text-green-600 dark:text-green-400" 
              : "text-red-600 dark:text-red-400"
            : remaining >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
        }`}>
          {formatCurrency(remaining)}
        </span>
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
      <td className="px-4 py-3">
        <button
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400
                   transition-colors duration-150 ease-in-out"
          title="Remove from budget"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
