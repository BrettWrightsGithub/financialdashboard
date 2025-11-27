"use client";

import { formatCurrency, formatMonth } from "@/lib/cashflow";
import type { BudgetSummary, CashflowGroup } from "@/types/database";

interface BudgetTableProps {
  month: string; // YYYY-MM format
}

// TODO: Replace with real data from Supabase
const MOCK_DATA: BudgetSummary[] = [
  // Income
  { categoryId: "1", categoryName: "Salary", cashflowGroup: "Income", expected: 7500, actual: 7500, variance: 0, percentUsed: 100 },
  { categoryId: "2", categoryName: "Rental Income", cashflowGroup: "Income", expected: 2800, actual: 2100, variance: -700, percentUsed: 75 },
  { categoryId: "3", categoryName: "T-Mobile Reimbursement", cashflowGroup: "Income", expected: 180, actual: 135, variance: -45, percentUsed: 75 },
  // Fixed
  { categoryId: "4", categoryName: "Mortgage", cashflowGroup: "Fixed", expected: 2200, actual: 2200, variance: 0, percentUsed: 100 },
  { categoryId: "5", categoryName: "Utilities", cashflowGroup: "Fixed", expected: 250, actual: 235, variance: -15, percentUsed: 94 },
  { categoryId: "6", categoryName: "Insurance", cashflowGroup: "Fixed", expected: 400, actual: 400, variance: 0, percentUsed: 100 },
  { categoryId: "7", categoryName: "Subscriptions", cashflowGroup: "Fixed", expected: 150, actual: 165, variance: 15, percentUsed: 110 },
  // Variable Essentials
  { categoryId: "8", categoryName: "Groceries", cashflowGroup: "Variable Essentials", expected: 800, actual: 720, variance: -80, percentUsed: 90 },
  { categoryId: "9", categoryName: "Gas/Fuel", cashflowGroup: "Variable Essentials", expected: 200, actual: 180, variance: -20, percentUsed: 90 },
  { categoryId: "10", categoryName: "Healthcare", cashflowGroup: "Variable Essentials", expected: 100, actual: 45, variance: -55, percentUsed: 45 },
  // Discretionary
  { categoryId: "11", categoryName: "Dining Out", cashflowGroup: "Discretionary", expected: 300, actual: 450, variance: 150, percentUsed: 150 },
  { categoryId: "12", categoryName: "Entertainment", cashflowGroup: "Discretionary", expected: 150, actual: 85, variance: -65, percentUsed: 57 },
  { categoryId: "13", categoryName: "Shopping", cashflowGroup: "Discretionary", expected: 200, actual: 320, variance: 120, percentUsed: 160 },
  // Debt
  { categoryId: "14", categoryName: "Car Payment", cashflowGroup: "Debt", expected: 450, actual: 450, variance: 0, percentUsed: 100 },
  { categoryId: "15", categoryName: "Student Loan", cashflowGroup: "Debt", expected: 350, actual: 350, variance: 0, percentUsed: 100 },
  // Savings
  { categoryId: "16", categoryName: "Emergency Fund", cashflowGroup: "Savings/Investing", expected: 500, actual: 500, variance: 0, percentUsed: 100 },
  { categoryId: "17", categoryName: "Investment", cashflowGroup: "Savings/Investing", expected: 400, actual: 400, variance: 0, percentUsed: 100 },
];

const GROUP_ORDER: CashflowGroup[] = [
  "Income",
  "Fixed",
  "Variable Essentials",
  "Discretionary",
  "Debt",
  "Savings/Investing",
];

export function BudgetTable({ month }: BudgetTableProps) {
  // Group data by cashflow group
  const groupedData = GROUP_ORDER.map((group) => ({
    group,
    items: MOCK_DATA.filter((d) => d.cashflowGroup === group),
  })).filter((g) => g.items.length > 0);

  // Calculate totals
  const totals = {
    income: { expected: 0, actual: 0 },
    expenses: { expected: 0, actual: 0 },
  };

  MOCK_DATA.forEach((d) => {
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
