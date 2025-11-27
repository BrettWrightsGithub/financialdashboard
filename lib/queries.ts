/**
 * Supabase query functions for fetching data
 */

import { supabase } from "./supabase";
import type {
  Account,
  Transaction,
  Category,
  BudgetTarget,
  ExpectedInflow,
  TransactionWithDetails,
} from "@/types/database";

// ============ Accounts ============

export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
  return data || [];
}

// ============ Categories ============

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
  return data || [];
}

// ============ Transactions ============

export async function getTransactions(options?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  cashflowGroup?: string;
  hideTransfers?: boolean;
  hidePassThrough?: boolean;
}): Promise<TransactionWithDetails[]> {
  let query = supabase
    .from("v_transactions_with_details")
    .select("*")
    .order("date", { ascending: false });

  if (options?.startDate) {
    query = query.gte("date", options.startDate);
  }
  if (options?.endDate) {
    query = query.lte("date", options.endDate);
  }
  if (options?.accountId) {
    query = query.eq("account_id", options.accountId);
  }
  if (options?.cashflowGroup) {
    query = query.eq("cashflow_group", options.cashflowGroup);
  }
  if (options?.hideTransfers) {
    query = query.eq("is_transfer", false);
  }
  if (options?.hidePassThrough) {
    query = query.eq("is_pass_through", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
  return data || [];
}

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string
): Promise<boolean> {
  // Get category details to update denormalized fields
  const { data: category } = await supabase
    .from("categories")
    .select("name, cashflow_group")
    .eq("id", categoryId)
    .single();

  const { error } = await supabase
    .from("transactions")
    .update({
      life_category_id: categoryId,
      cashflow_group: category?.cashflow_group,
      category_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (error) {
    console.error("Error updating transaction:", error);
    return false;
  }
  return true;
}

// ============ Budget Targets ============

export async function getBudgetTargets(month: string): Promise<BudgetTarget[]> {
  // month format: YYYY-MM, need to convert to first day of month
  const monthDate = `${month}-01`;

  const { data, error } = await supabase
    .from("budget_targets")
    .select("*")
    .eq("month", monthDate);

  if (error) {
    console.error("Error fetching budget targets:", error);
    return [];
  }
  return data || [];
}

export async function getBudgetSummary(month: string): Promise<{
  categories: Category[];
  targets: BudgetTarget[];
  actuals: { category_id: string; total: number }[];
}> {
  const monthDate = `${month}-01`;
  const startDate = monthDate;
  const endDate = new Date(
    parseInt(month.split("-")[0]),
    parseInt(month.split("-")[1]),
    0
  ).toISOString().split("T")[0];

  // Fetch categories, targets, and transactions in parallel
  const [categoriesRes, targetsRes, transactionsRes] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("budget_targets").select("*").eq("month", monthDate),
    supabase
      .from("transactions")
      .select("life_category_id, amount")
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("status", "posted")
      .eq("is_transfer", false),
  ]);

  // Calculate actuals by category
  const actualsByCategory: Record<string, number> = {};
  for (const t of transactionsRes.data || []) {
    if (t.life_category_id) {
      actualsByCategory[t.life_category_id] =
        (actualsByCategory[t.life_category_id] || 0) + Math.abs(t.amount);
    }
  }

  const actuals = Object.entries(actualsByCategory).map(([category_id, total]) => ({
    category_id,
    total,
  }));

  return {
    categories: categoriesRes.data || [],
    targets: targetsRes.data || [],
    actuals,
  };
}

// ============ Expected Inflows ============

export async function getExpectedInflows(month: string): Promise<ExpectedInflow[]> {
  const monthDate = `${month}-01`;

  const { data, error } = await supabase
    .from("expected_inflows")
    .select("*")
    .eq("month", monthDate)
    .order("expected_date");

  if (error) {
    console.error("Error fetching expected inflows:", error);
    return [];
  }
  return data || [];
}

// ============ Dashboard Aggregates ============

export async function getDashboardData(month: string) {
  const monthDate = `${month}-01`;
  const [year, monthNum] = month.split("-").map(Number);
  const startDate = monthDate;
  const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];

  // Fetch all needed data in parallel
  const [transactionsRes, budgetRes, inflowsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("status", "posted"),
    supabase.from("budget_targets").select("*, categories(name, cashflow_group)").eq("month", monthDate),
    supabase.from("expected_inflows").select("*").eq("month", monthDate),
  ]);

  const transactions = transactionsRes.data || [];
  const budgetTargets = budgetRes.data || [];
  const expectedInflows = inflowsRes.data || [];

  // Calculate cashflow by group
  const cashflow = {
    income: 0,
    fixed: 0,
    variableEssentials: 0,
    discretionary: 0,
    debt: 0,
    savings: 0,
    business: 0,
  };

  for (const t of transactions) {
    if (t.is_transfer) continue;

    const amount = t.amount;
    switch (t.cashflow_group) {
      case "Income":
        cashflow.income += amount;
        break;
      case "Fixed":
        cashflow.fixed += Math.abs(amount);
        break;
      case "Variable Essentials":
        cashflow.variableEssentials += Math.abs(amount);
        break;
      case "Discretionary":
        cashflow.discretionary += Math.abs(amount);
        break;
      case "Debt":
        cashflow.debt += Math.abs(amount);
        break;
      case "Savings/Investing":
        cashflow.savings += Math.abs(amount);
        break;
      case "Business":
        cashflow.business += amount; // Can be income or expense
        break;
    }
  }

  const totalExpenses =
    cashflow.fixed +
    cashflow.variableEssentials +
    cashflow.discretionary +
    cashflow.debt +
    cashflow.savings;

  const netCashflow = cashflow.income + cashflow.business - totalExpenses;

  // Calculate weekly safe-to-spend
  const discretionaryBudget = budgetTargets
    .filter((bt: any) => bt.categories?.cashflow_group === "Discretionary")
    .reduce((sum: number, bt: any) => sum + bt.amount, 0);

  const weeklyTarget = discretionaryBudget / 4.33;

  // Get this week's discretionary spending
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const weeklySpent = transactions
    .filter(
      (t) =>
        t.date >= weekStartStr &&
        t.cashflow_group === "Discretionary" &&
        !t.is_transfer &&
        !t.is_pass_through
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const safeToSpend = weeklyTarget - weeklySpent;

  // Outstanding inflows
  const outstandingInflows = expectedInflows.filter((i) => i.status === "pending");

  return {
    cashflow,
    totalExpenses,
    netCashflow,
    safeToSpend: {
      weeklyTarget,
      weeklySpent,
      remaining: safeToSpend,
      monthlyBudget: discretionaryBudget,
    },
    outstandingInflows,
    transactions,
  };
}
