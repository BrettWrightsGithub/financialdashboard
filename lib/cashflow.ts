/**
 * Cashflow calculation helpers
 * Based on docs/financial-command-center-overview.md
 */

import type { Transaction, CashflowSummary, BudgetTarget } from "@/types/database";

/**
 * Calculate monthly net cashflow from transactions
 * Excludes transfers (is_transfer = true)
 * Includes only accounts with include_in_cashflow = true (assumed pre-filtered)
 */
export function calculateMonthlyCashflow(
  transactions: Transaction[],
  month: string // YYYY-MM format
): CashflowSummary {
  // Filter to only posted, non-transfer transactions for the given month
  const monthTransactions = transactions.filter((t) => {
    const txMonth = t.date.substring(0, 7);
    return txMonth === month && t.status === "posted" && !t.is_transfer;
  });

  // Sum by cashflow group
  const sums = {
    income: 0,
    fixed: 0,
    variableEssentials: 0,
    discretionary: 0,
    debt: 0,
    savings: 0,
    business: 0,
  };

  for (const t of monthTransactions) {
    const amount = t.amount;
    switch (t.cashflow_group) {
      case "Income":
        sums.income += amount;
        break;
      case "Fixed":
        sums.fixed += amount;
        break;
      case "Variable Essentials":
        sums.variableEssentials += amount;
        break;
      case "Discretionary":
        sums.discretionary += amount;
        break;
      case "Debt":
        sums.debt += amount;
        break;
      case "Savings/Investing":
        sums.savings += amount;
        break;
      case "Business":
        sums.business += amount;
        break;
      // Transfer and Other are excluded from cashflow
    }
  }

  // Net cashflow = sum of all groups (expenses are already negative)
  const netCashflow =
    sums.income +
    sums.fixed +
    sums.variableEssentials +
    sums.discretionary +
    sums.debt +
    sums.savings +
    sums.business;

  return {
    month,
    ...sums,
    netCashflow,
  };
}

/**
 * Calculate weekly Safe-to-Spend
 * 
 * Formula:
 * 1. Monthly discretionary budget / 4.33 = weekly target
 * 2. Weekly target - discretionary spent this week = safe to spend
 * 
 * Excludes:
 * - Transfers (is_transfer = true)
 * - Pass-through expenses (is_pass_through = true)
 */
export function calculateSafeToSpend(
  transactions: Transaction[],
  budgetTargets: BudgetTarget[],
  weekStart: Date,
  weekEnd: Date
): {
  weeklyTarget: number;
  spentThisWeek: number;
  safeToSpend: number;
  monthlyBudget: number;
} {
  // Calculate monthly discretionary budget
  const monthlyBudget = budgetTargets
    .filter((bt) => {
      // We need to join with categories to filter by cashflow_group
      // For now, assume budgetTargets include cashflow_group info
      // This will be enhanced when we have full category data
      return true; // Placeholder - will filter by Discretionary group
    })
    .reduce((sum, bt) => sum + bt.amount, 0);

  // Convert to weekly target (month / 4.33 weeks)
  const weeklyTarget = monthlyBudget / 4.33;

  // Calculate discretionary spending this week
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const weekTransactions = transactions.filter((t) => {
    return (
      t.date >= weekStartStr &&
      t.date <= weekEndStr &&
      t.cashflow_group === "Discretionary" &&
      !t.is_transfer &&
      !t.is_pass_through &&
      t.status === "posted"
    );
  });

  // Sum spending (amounts are negative for expenses)
  const spentThisWeek = Math.abs(
    weekTransactions.reduce((sum, t) => sum + t.amount, 0)
  );

  const safeToSpend = weeklyTarget - spentThisWeek;

  return {
    weeklyTarget,
    spentThisWeek,
    safeToSpend,
    monthlyBudget,
  };
}

/**
 * Get the start and end dates for the current week (Monday-Sunday)
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  // Adjust so Monday = 0, Sunday = 6
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

/**
 * Get the first and last day of a month
 */
export function getMonthRange(monthStr: string): { start: Date; end: Date } {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Day 0 of next month = last day of this month
  return { start, end };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format currency with cents for precise display
 */
export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Format a month string for display (e.g., "2025-03" -> "March 2025")
 */
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
