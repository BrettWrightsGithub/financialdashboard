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
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - returning empty accounts");
    return [];
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    // Only log error if it's not a simple "table doesn't exist" error (common in dev)
    if (!error.message.includes('relation') || !error.message.includes('does not exist')) {
      console.error("Error fetching accounts:", error);
    }
    return [];
  }
  return data || [];
}

// ============ Categories ============

export async function getCategories(): Promise<Category[]> {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - returning empty categories");
    return [];
  }

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    // Only log error if it's not a simple "table doesn't exist" error (common in dev)
    if (!error.message.includes('relation') || !error.message.includes('does not exist')) {
      console.error("Error fetching categories:", error);
    }
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
  searchQuery?: string;
}): Promise<TransactionWithDetails[]> {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - returning empty transactions");
    return [];
  }

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
  if (options?.searchQuery) {
    query = query.ilike("description_raw", `%${options.searchQuery}%`);
  }

  const { data, error } = await query;

  if (error) {
    // Only log error if it's not a simple "table doesn't exist" error (common in dev)
    if (!error.message.includes('relation') || !error.message.includes('does not exist')) {
      console.error("Error fetching transactions:", error);
    }
    return [];
  }
  return data || [];
}

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string
): Promise<boolean> {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - cannot update transaction category");
    return false;
  }

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

export async function updateTransactionFlags(
  transactionId: string,
  flags: {
    is_transfer?: boolean;
    is_pass_through?: boolean;
    is_business?: boolean;
  }
): Promise<boolean> {
  if (!supabase) {
    console.warn("Supabase not configured - cannot update transaction flags");
    return false;
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      ...flags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (error) {
    console.error("Error updating transaction flags:", error);
    return false;
  }
  return true;
}

// ============ Budget Targets ============

export async function getBudgetTargets(month: string): Promise<BudgetTarget[]> {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - returning empty budget targets");
    return [];
  }

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

// Get actuals for a specific month by category
export async function getActualsByCategory(month: string): Promise<{ category_id: string; total: number }[]> {
  if (!supabase) {
    console.warn("Supabase not configured - returning empty actuals");
    return [];
  }

  const monthDate = `${month}-01`;
  const [year, monthNum] = month.split("-").map(Number);
  const startDate = monthDate;
  const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];

  // Get cashflow accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("is_active", true)
    .eq("include_in_cashflow", true);

  const cashflowAccountIds = (accounts || []).map(a => a.id);

  // Get transactions for the month
  const { data: transactions } = await supabase
    .from("transactions")
    .select("life_category_id, amount")
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("status", "posted")
    .eq("is_transfer", false)
    .eq("is_split_parent", false)
    .in("account_id", cashflowAccountIds);

  const actualsByCategory: Record<string, number> = {};
  (transactions || []).forEach(t => {
    if (t.life_category_id) {
      actualsByCategory[t.life_category_id] = (actualsByCategory[t.life_category_id] || 0) + t.amount;
    }
  });

  return Object.entries(actualsByCategory).map(([category_id, total]) => ({
    category_id,
    total,
  }));
}

// Get 3-month rolling average by category
export async function getThreeMonthAverage(endMonth: string): Promise<{ category_id: string; average: number }[]> {
  if (!supabase) {
    console.warn("Supabase not configured - returning empty averages");
    return [];
  }

  const [year, monthNum] = endMonth.split("-").map(Number);
  const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
  const startDate = new Date(year, monthNum - 3, 1).toISOString().split("T")[0];

  // Get cashflow accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("is_active", true)
    .eq("include_in_cashflow", true);

  const cashflowAccountIds = (accounts || []).map(a => a.id);

  // Get transactions for the 3-month period
  const { data: transactions } = await supabase
    .from("transactions")
    .select("life_category_id, amount")
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("status", "posted")
    .eq("is_transfer", false)
    .eq("is_split_parent", false)
    .in("account_id", cashflowAccountIds);

  const actualsByCategory: Record<string, number[]> = {};
  (transactions || []).forEach(t => {
    if (t.life_category_id) {
      if (!actualsByCategory[t.life_category_id]) {
        actualsByCategory[t.life_category_id] = [];
      }
      actualsByCategory[t.life_category_id].push(t.amount);
    }
  });

  return Object.entries(actualsByCategory).map(([category_id, amounts]) => ({
    category_id,
    average: amounts.reduce((sum, amount) => sum + Math.abs(amount), 0) / amounts.length,
  }));
}

// Get most recent month with budget data
export async function getMostRecentBudgetMonth(): Promise<string | null> {
  if (!supabase) {
    console.warn("Supabase not configured - returning null");
    return null;
  }

  const { data, error } = await supabase
    .from("budget_targets")
    .select("month")
    .not("month", "is", null)
    .order("month", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Convert YYYY-MM-DD to YYYY-MM
  const monthDate = data[0].month;
  return monthDate.substring(0, 7);
}

// Upsert a budget target
export async function upsertBudgetTarget(
  categoryId: string, 
  month: string, 
  amount: number, 
  notes?: string
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const monthDate = `${month}-01`;

  const { error } = await supabase
    .from("budget_targets")
    .upsert({
      category_id: categoryId,
      month: monthDate,
      amount,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "category_id,month",
    });

  if (error) {
    throw error;
  }
}

// Delete a budget target
export async function deleteBudgetTarget(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { error } = await supabase
    .from("budget_targets")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

// Copy budget from one month to another
export async function copyBudgetForward(
  sourceMonth: string, 
  destMonth: string, 
  includeInflows: boolean
): Promise<{ targetsCopied: number; inflowsCopied: number }> {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const response = await fetch("/api/budget-targets/copy-forward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceMonth,
      destMonth,
      includeExpectedInflows: includeInflows,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to copy budget forward");
  }

  const result = await response.json();
  return {
    targetsCopied: result.data.targetsCopied,
    inflowsCopied: result.data.inflowsCopied,
  };
}

export async function getBudgetSummary(month: string): Promise<{
  categories: Category[];
  targets: BudgetTarget[];
  actuals: { category_id: string; total: number }[];
  actualsByCashflowGroup: { cashflow_group: string; total: number }[];
}> {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - returning empty budget summary");
    return { categories: [], targets: [], actuals: [], actualsByCashflowGroup: [] };
  }

  const monthDate = `${month}-01`;
  const startDate = monthDate;
  const endDate = new Date(
    parseInt(month.split("-")[0]),
    parseInt(month.split("-")[1]),
    0
  ).toISOString().split("T")[0];

  // Fetch categories, targets, accounts, and transactions in parallel
  const [categoriesRes, targetsRes, accountsRes, transactionsRes] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("budget_targets").select("*").eq("month", monthDate),
    supabase.from("accounts").select("id, include_in_cashflow").eq("is_active", true),
    supabase
      .from("transactions")
      .select("life_category_id, amount, cashflow_group, account_id")
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("status", "posted")
      .eq("is_transfer", false)
      .eq("is_split_parent", false),
  ]);

  // Create a Set of account IDs that should be included in cashflow
  const cashflowAccountIds = new Set(
    (accountsRes.data || []).filter((a) => a.include_in_cashflow).map((a) => a.id)
  );

  // Filter transactions to only include those from cashflow accounts
  const cashflowTransactions = (transactionsRes.data || []).filter((t) =>
    cashflowAccountIds.has(t.account_id)
  );

  // Calculate actuals by category using SIGNED sums (not Math.abs)
  // This is critical for refund handling - refunds are positive amounts in expense categories
  const actualsByCategory: Record<string, number> = {};
  const actualsByCashflowGroup: Record<string, number> = {};
  
  for (const t of cashflowTransactions) {
    if (t.life_category_id) {
      actualsByCategory[t.life_category_id] =
        (actualsByCategory[t.life_category_id] || 0) + t.amount;
    }
    if (t.cashflow_group) {
      actualsByCashflowGroup[t.cashflow_group] =
        (actualsByCashflowGroup[t.cashflow_group] || 0) + t.amount;
    }
  }

  const actuals = Object.entries(actualsByCategory).map(([category_id, total]) => ({
    category_id,
    total,
  }));
  
  // Include cashflow_group actuals for categories that don't have direct transaction links
  const actualsByCashflowGroupArray = Object.entries(actualsByCashflowGroup).map(([cashflow_group, total]) => ({
    cashflow_group,
    total,
  }));

  return {
    categories: categoriesRes.data || [],
    targets: targetsRes.data || [],
    actuals,
    actualsByCashflowGroup: actualsByCashflowGroupArray,
  };
}

// ============ Expected Inflows ============

export async function getExpectedInflows(month: string): Promise<ExpectedInflow[]> {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - returning empty expected inflows");
    return [];
  }

  const monthDate = `${month}-01`;

  const { data, error } = await supabase
    .from("expected_inflows")
    .select("*")
    .eq("month", monthDate)
    .order("expected_date");

  if (error) {
    // Only log error if it's not a simple "table doesn't exist" error (common in dev)
    if (!error.message.includes('relation') || !error.message.includes('does not exist')) {
      console.error("Error fetching expected inflows:", error);
    }
    return [];
  }
  return data || [];
}

// ============ Dashboard Aggregates ============

export async function getCashflowTrend(months: number = 6): Promise<{ month: string; net: number }[]> {
  if (!supabase) {
    console.warn("Supabase not configured - returning empty cashflow trend");
    return [];
  }

  const trend = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    
    const data = await getDashboardData(monthStr);
    
    trend.push({
      month: monthStr,
      net: data.netCashflow,
    });
  }

  return trend;
}

export async function getOverspentCategories(
  month: string,
  limit: number = 3
): Promise<{ categoryId: string; categoryName: string; budgeted: number; actual: number; overspent: number }[]> {
  if (!supabase) {
    console.warn("Supabase not configured - returning empty overspent categories");
    return [];
  }

  const monthDate = `${month}-01`;
  const [year, monthNum] = month.split("-").map(Number);
  const startDate = monthDate;
  const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];

  // Fetch budget targets and accounts
  const [budgetRes, accountsRes] = await Promise.all([
    supabase
      .from("budget_targets")
      .select("*, categories(id, name, cashflow_group)")
      .eq("month", monthDate),
    supabase.from("accounts").select("id, include_in_cashflow").eq("is_active", true),
  ]);

  const budgetTargets = budgetRes.data || [];
  const accounts = accountsRes.data || [];

  // Create a Set of account IDs that should be included in cashflow
  const cashflowAccountIds = new Set(
    accounts.filter((a) => a.include_in_cashflow).map((a) => a.id)
  );

  // Fetch transactions for the month
  const { data: allTransactions } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("status", "posted")
    .eq("is_transfer", false)
    .eq("is_split_parent", false);

  const transactions = (allTransactions || []).filter((t) =>
    cashflowAccountIds.has(t.account_id)
  );

  // Calculate actual spending by category
  const actualByCategory: Record<string, number> = {};
  for (const t of transactions) {
    if (t.life_category_id && t.amount < 0) {
      actualByCategory[t.life_category_id] =
        (actualByCategory[t.life_category_id] || 0) + Math.abs(t.amount);
    }
  }

  // Compare budget vs actual for expense categories
  const overspentList = budgetTargets
    .filter((bt: any) => {
      const group = bt.categories?.cashflow_group;
      return group && group !== "Income" && group !== "Transfer";
    })
    .map((bt: any) => {
      const categoryId = bt.category_id;
      const actual = actualByCategory[categoryId] || 0;
      const budgeted = Math.abs(bt.amount);
      const overspent = actual - budgeted;

      return {
        categoryId,
        categoryName: bt.categories?.name || "Unknown",
        budgeted,
        actual,
        overspent,
      };
    })
    .filter((item) => item.overspent > 0)
    .sort((a, b) => b.overspent - a.overspent)
    .slice(0, limit);

  return overspentList;
}

export async function getDashboardData(month: string) {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn("Supabase not configured - returning empty dashboard data");
    return {
      cashflow: {
        income: 0,
        fixed: 0,
        variableEssentials: 0,
        discretionary: 0,
        debt: 0,
        savings: 0,
        business: 0,
      },
      totalExpenses: 0,
      netCashflow: 0,
      safeToSpend: {
        weeklyTarget: 0,
        weeklySpent: 0,
        remaining: 0,
        monthlyBudget: 0,
      },
      outstandingInflows: [],
      transactions: [],
    };
  }

  const monthDate = `${month}-01`;
  const [year, monthNum] = month.split("-").map(Number);
  const startDate = monthDate;
  const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];

  // Fetch all needed data in parallel
  const [transactionsRes, budgetRes, inflowsRes, accountsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("status", "posted"),
    supabase.from("budget_targets").select("*, categories(name, cashflow_group)").eq("month", monthDate),
    supabase.from("expected_inflows").select("*").eq("month", monthDate),
    supabase.from("accounts").select("id, include_in_cashflow").eq("is_active", true),
  ]);

  const allTransactions = transactionsRes.data || [];
  const budgetTargets = budgetRes.data || [];
  const expectedInflows = inflowsRes.data || [];
  const accounts = accountsRes.data || [];

  // Create a Set of account IDs that should be included in cashflow
  const cashflowAccountIds = new Set(
    accounts.filter((a) => a.include_in_cashflow).map((a) => a.id)
  );

  // Filter transactions to only include those from cashflow accounts
  const transactions = allTransactions.filter((t) =>
    cashflowAccountIds.has(t.account_id)
  );

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
    // Skip transfers and split parents (children are counted instead)
    if (t.is_transfer || t.is_split_parent) continue;

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
        !t.is_pass_through &&
        !t.is_split_parent
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
