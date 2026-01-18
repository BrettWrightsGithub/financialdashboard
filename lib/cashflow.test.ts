import {
  calculateMonthlyCashflow,
  calculateSafeToSpend,
  getCurrentWeekRange,
  getMonthRange,
  formatCurrency,
  formatCurrencyPrecise,
  getCurrentMonth,
  formatMonth,
} from "./cashflow";
import type { Transaction, BudgetTarget } from "@/types/database";

describe("Cashflow Calculations", () => {
  describe("calculateMonthlyCashflow", () => {
    let transactions: Transaction[];

    beforeEach(() => {
      // Create mock transactions for testing
      transactions = [
        {
          id: "1",
          date: "2025-01-15",
          amount: 5000,
          cashflow_group: "Income",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "2",
          date: "2025-01-20",
          amount: -1500,
          cashflow_group: "Fixed",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "3",
          date: "2025-01-22",
          amount: -500,
          cashflow_group: "Variable Essentials",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "4",
          date: "2025-01-25",
          amount: -300,
          cashflow_group: "Discretionary",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
      ];
    });

    it("should calculate net cashflow correctly for a month", () => {
      const result = calculateMonthlyCashflow(transactions, "2025-01");

      expect(result.income).toBe(5000);
      expect(result.fixed).toBe(-1500);
      expect(result.variableEssentials).toBe(-500);
      expect(result.discretionary).toBe(-300);
      expect(result.netCashflow).toBe(2700); // 5000 - 1500 - 500 - 300
    });

    it("should exclude transfer transactions", () => {
      transactions.push({
        id: "5",
        date: "2025-01-28",
        amount: -1000,
        cashflow_group: "Transfer",
        status: "posted",
        is_transfer: true,
        is_split_parent: false,
      } as Transaction);

      const result = calculateMonthlyCashflow(transactions, "2025-01");

      expect(result.netCashflow).toBe(2700); // Should not include the transfer
    });

    it("should exclude split parent transactions", () => {
      transactions.push({
        id: "6",
        date: "2025-01-30",
        amount: -200,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: false,
        is_split_parent: true,
      } as Transaction);

      const result = calculateMonthlyCashflow(transactions, "2025-01");

      expect(result.netCashflow).toBe(2700); // Should not include the split parent
    });

    it("should only include posted transactions", () => {
      transactions.push({
        id: "7",
        date: "2025-01-31",
        amount: -100,
        cashflow_group: "Discretionary",
        status: "pending",
        is_transfer: false,
        is_split_parent: false,
      } as Transaction);

      const result = calculateMonthlyCashflow(transactions, "2025-01");

      expect(result.netCashflow).toBe(2700); // Should not include pending
    });

    it("should only include transactions from the specified month", () => {
      transactions.push({
        id: "8",
        date: "2025-02-01",
        amount: -500,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: false,
        is_split_parent: false,
      } as Transaction);

      const result = calculateMonthlyCashflow(transactions, "2025-01");

      expect(result.netCashflow).toBe(2700); // Should not include Feb transaction
    });

    it("should handle all cashflow groups correctly", () => {
      const allGroupsTransactions: Transaction[] = [
        {
          id: "1",
          date: "2025-01-15",
          amount: 5000,
          cashflow_group: "Income",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "2",
          date: "2025-01-20",
          amount: -1000,
          cashflow_group: "Fixed",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "3",
          date: "2025-01-21",
          amount: -500,
          cashflow_group: "Variable Essentials",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "4",
          date: "2025-01-22",
          amount: -300,
          cashflow_group: "Discretionary",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "5",
          date: "2025-01-23",
          amount: -200,
          cashflow_group: "Debt",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "6",
          date: "2025-01-24",
          amount: -100,
          cashflow_group: "Savings/Investing",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "7",
          date: "2025-01-25",
          amount: -50,
          cashflow_group: "Business",
          status: "posted",
          is_transfer: false,
          is_split_parent: false,
        } as Transaction,
      ];

      const result = calculateMonthlyCashflow(allGroupsTransactions, "2025-01");

      expect(result.income).toBe(5000);
      expect(result.fixed).toBe(-1000);
      expect(result.variableEssentials).toBe(-500);
      expect(result.discretionary).toBe(-300);
      expect(result.debt).toBe(-200);
      expect(result.savings).toBe(-100);
      expect(result.business).toBe(-50);
      expect(result.netCashflow).toBe(2850); // 5000 - 1000 - 500 - 300 - 200 - 100 - 50
    });

    it("should handle months with no transactions", () => {
      const result = calculateMonthlyCashflow(transactions, "2025-02");

      expect(result.income).toBe(0);
      expect(result.fixed).toBe(0);
      expect(result.variableEssentials).toBe(0);
      expect(result.discretionary).toBe(0);
      expect(result.debt).toBe(0);
      expect(result.savings).toBe(0);
      expect(result.business).toBe(0);
      expect(result.netCashflow).toBe(0);
    });
  });

  describe("calculateSafeToSpend", () => {
    let transactions: Transaction[];
    let budgetTargets: BudgetTarget[];
    let weekStart: Date;
    let weekEnd: Date;

    beforeEach(() => {
      // Create a week range (Jan 13-19, 2025 - Monday to Sunday)
      weekStart = new Date("2025-01-13");
      weekEnd = new Date("2025-01-19");

      // Budget targets for the month (total $1300 for discretionary)
      budgetTargets = [
        {
          id: "1",
          category_id: "cat1",
          month: "2025-01",
          amount: 1300,
        } as BudgetTarget,
      ];

      // Discretionary transactions for the week
      transactions = [
        {
          id: "1",
          date: "2025-01-14",
          amount: -50,
          cashflow_group: "Discretionary",
          status: "posted",
          is_transfer: false,
          is_pass_through: false,
          is_split_parent: false,
        } as Transaction,
        {
          id: "2",
          date: "2025-01-16",
          amount: -100,
          cashflow_group: "Discretionary",
          status: "posted",
          is_transfer: false,
          is_pass_through: false,
          is_split_parent: false,
        } as Transaction,
      ];
    });

    it("should calculate Safe-to-Spend correctly", () => {
      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.monthlyBudget).toBe(1300);
      expect(result.weeklyTarget).toBeCloseTo(300.23, 2); // 1300 / 4.33
      expect(result.spentThisWeek).toBe(150); // 50 + 100
      expect(result.safeToSpend).toBeCloseTo(150.23, 2); // 300.23 - 150
    });

    it("should exclude transfer transactions", () => {
      transactions.push({
        id: "3",
        date: "2025-01-17",
        amount: -200,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: true,
        is_pass_through: false,
        is_split_parent: false,
      } as Transaction);

      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.spentThisWeek).toBe(150); // Should not include transfer
    });

    it("should exclude pass-through transactions", () => {
      transactions.push({
        id: "4",
        date: "2025-01-18",
        amount: -300,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: false,
        is_pass_through: true,
        is_split_parent: false,
      } as Transaction);

      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.spentThisWeek).toBe(150); // Should not include pass-through
    });

    it("should exclude split parent transactions", () => {
      transactions.push({
        id: "5",
        date: "2025-01-19",
        amount: -400,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: false,
        is_pass_through: false,
        is_split_parent: true,
      } as Transaction);

      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.spentThisWeek).toBe(150); // Should not include split parent
    });

    it("should only include posted transactions", () => {
      transactions.push({
        id: "6",
        date: "2025-01-19",
        amount: -500,
        cashflow_group: "Discretionary",
        status: "pending",
        is_transfer: false,
        is_pass_through: false,
        is_split_parent: false,
      } as Transaction);

      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.spentThisWeek).toBe(150); // Should not include pending
    });

    it("should only include discretionary transactions", () => {
      transactions.push({
        id: "7",
        date: "2025-01-19",
        amount: -600,
        cashflow_group: "Fixed",
        status: "posted",
        is_transfer: false,
        is_pass_through: false,
        is_split_parent: false,
      } as Transaction);

      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.spentThisWeek).toBe(150); // Should not include Fixed expenses
    });

    it("should handle week boundaries correctly", () => {
      // Add transactions outside the week range
      transactions.push({
        id: "8",
        date: "2025-01-12", // Sunday before the week
        amount: -100,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: false,
        is_pass_through: false,
        is_split_parent: false,
      } as Transaction);

      transactions.push({
        id: "9",
        date: "2025-01-20", // Monday after the week
        amount: -100,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: false,
        is_pass_through: false,
        is_split_parent: false,
      } as Transaction);

      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.spentThisWeek).toBe(150); // Should not include transactions outside range
    });

    it("should handle overspending correctly (negative safe-to-spend)", () => {
      transactions.push({
        id: "10",
        date: "2025-01-19",
        amount: -500,
        cashflow_group: "Discretionary",
        status: "posted",
        is_transfer: false,
        is_pass_through: false,
        is_split_parent: false,
      } as Transaction);

      const result = calculateSafeToSpend(transactions, budgetTargets, weekStart, weekEnd);

      expect(result.spentThisWeek).toBe(650); // 50 + 100 + 500
      expect(result.safeToSpend).toBeCloseTo(-349.77, 2); // 300.23 - 650
    });
  });

  describe("getCurrentWeekRange", () => {
    it("should return Monday to Sunday range", () => {
      const { start, end } = getCurrentWeekRange();

      // Check that start is a Monday
      expect(start.getDay()).toBe(1); // Monday = 1

      // Check that end is a Sunday
      expect(end.getDay()).toBe(0); // Sunday = 0

      // Check that the range spans from Monday to Sunday (almost 7 days)
      const diff = end.getTime() - start.getTime();
      const expectedDiff = 7 * 24 * 60 * 60 * 1000 - 1; // 7 days minus 1 millisecond
      expect(diff).toBe(expectedDiff);
    });

    it("should set start time to 00:00:00", () => {
      const { start } = getCurrentWeekRange();

      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it("should set end time to 23:59:59.999", () => {
      const { end } = getCurrentWeekRange();

      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });
  });

  describe("getMonthRange", () => {
    it("should return first and last day of January 2025", () => {
      const { start, end } = getMonthRange("2025-01");

      expect(start.getFullYear()).toBe(2025);
      expect(start.getMonth()).toBe(0); // January = 0
      expect(start.getDate()).toBe(1);

      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(0);
      expect(end.getDate()).toBe(31); // January has 31 days
    });

    it("should handle February correctly (28 days in non-leap year)", () => {
      const { start, end } = getMonthRange("2025-02");

      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(28); // 2025 is not a leap year
    });

    it("should handle February correctly (29 days in leap year)", () => {
      const { start, end } = getMonthRange("2024-02");

      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(29); // 2024 is a leap year
    });

    it("should handle months with 30 days", () => {
      const { start, end } = getMonthRange("2025-04");

      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(30); // April has 30 days
    });

    it("should handle December correctly", () => {
      const { start, end } = getMonthRange("2025-12");

      expect(start.getMonth()).toBe(11); // December = 11
      expect(start.getDate()).toBe(1);
      expect(end.getMonth()).toBe(11);
      expect(end.getDate()).toBe(31);
    });
  });

  describe("formatCurrency", () => {
    it("should format positive amounts correctly", () => {
      expect(formatCurrency(1234.56)).toBe("$1,235");
    });

    it("should format negative amounts correctly", () => {
      expect(formatCurrency(-1234.56)).toBe("-$1,235");
    });

    it("should round to nearest dollar", () => {
      expect(formatCurrency(1234.49)).toBe("$1,234");
      expect(formatCurrency(1234.50)).toBe("$1,235");
    });

    it("should handle zero correctly", () => {
      expect(formatCurrency(0)).toBe("$0");
    });

    it("should handle large amounts with commas", () => {
      expect(formatCurrency(1234567)).toBe("$1,234,567");
    });
  });

  describe("formatCurrencyPrecise", () => {
    it("should format with two decimal places", () => {
      expect(formatCurrencyPrecise(1234.56)).toBe("$1,234.56");
    });

    it("should show .00 for whole amounts", () => {
      expect(formatCurrencyPrecise(1234)).toBe("$1,234.00");
    });

    it("should format negative amounts with precision", () => {
      expect(formatCurrencyPrecise(-1234.56)).toBe("-$1,234.56");
    });

    it("should handle zero with precision", () => {
      expect(formatCurrencyPrecise(0)).toBe("$0.00");
    });
  });

  describe("getCurrentMonth", () => {
    it("should return current month in YYYY-MM format", () => {
      const result = getCurrentMonth();

      expect(result).toMatch(/^\d{4}-\d{2}$/); // Matches YYYY-MM format
    });

    it("should pad single-digit months with zero", () => {
      const result = getCurrentMonth();
      const month = result.split("-")[1];

      expect(month.length).toBe(2);
    });
  });

  describe("formatMonth", () => {
    it("should format January 2025 correctly", () => {
      expect(formatMonth("2025-01")).toBe("January 2025");
    });

    it("should format December 2024 correctly", () => {
      expect(formatMonth("2024-12")).toBe("December 2024");
    });

    it("should format June 2025 correctly", () => {
      expect(formatMonth("2025-06")).toBe("June 2025");
    });
  });
});
