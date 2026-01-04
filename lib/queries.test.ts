import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Dashboard Calculations", () => {
  describe("Transaction Filtering", () => {
    it("should exclude transfers from cashflow calculations", () => {
      const transactions = [
        { id: "1", amount: -100, is_transfer: false, is_split_parent: false, status: "posted" },
        { id: "2", amount: -50, is_transfer: true, is_split_parent: false, status: "posted" },
        { id: "3", amount: -75, is_transfer: false, is_split_parent: false, status: "posted" },
      ];

      const filtered = transactions.filter((t) => !t.is_transfer && !t.is_split_parent && t.status === "posted");
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(["1", "3"]);
    });

    it("should exclude pending transactions from cashflow calculations", () => {
      const transactions = [
        { id: "1", amount: -100, is_transfer: false, is_split_parent: false, status: "posted" },
        { id: "2", amount: -50, is_transfer: false, is_split_parent: false, status: "pending" },
        { id: "3", amount: -75, is_transfer: false, is_split_parent: false, status: "posted" },
      ];

      const filtered = transactions.filter((t) => !t.is_transfer && !t.is_split_parent && t.status === "posted");
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(["1", "3"]);
    });

    it("should exclude split parent transactions from cashflow calculations", () => {
      const transactions = [
        { id: "1", amount: -100, is_transfer: false, is_split_parent: false, status: "posted" },
        { id: "2", amount: -150, is_transfer: false, is_split_parent: true, status: "posted" },
        { id: "3", amount: -50, is_transfer: false, is_split_parent: false, status: "posted", parent_transaction_id: "2" },
        { id: "4", amount: -100, is_transfer: false, is_split_parent: false, status: "posted", parent_transaction_id: "2" },
      ];

      const filtered = transactions.filter((t) => !t.is_transfer && !t.is_split_parent && t.status === "posted");
      
      expect(filtered).toHaveLength(3);
      expect(filtered.map((t) => t.id)).toEqual(["1", "3", "4"]);
    });

    it("should filter to only cashflow accounts", () => {
      const accounts = [
        { id: "acc1", include_in_cashflow: true },
        { id: "acc2", include_in_cashflow: false },
        { id: "acc3", include_in_cashflow: true },
      ];

      const transactions = [
        { id: "1", account_id: "acc1", amount: -100 },
        { id: "2", account_id: "acc2", amount: -50 },
        { id: "3", account_id: "acc3", amount: -75 },
      ];

      const cashflowAccountIds = new Set(
        accounts.filter((a) => a.include_in_cashflow).map((a) => a.id)
      );

      const filtered = transactions.filter((t) => cashflowAccountIds.has(t.account_id));
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(["1", "3"]);
    });
  });

  describe("Cashflow Aggregation", () => {
    it("should correctly aggregate income and expenses", () => {
      const transactions = [
        { cashflow_group: "Income", amount: 5000 },
        { cashflow_group: "Fixed", amount: -1500 },
        { cashflow_group: "Discretionary", amount: -300 },
        { cashflow_group: "Variable Essentials", amount: -800 },
      ];

      let income = 0;
      let expenses = 0;

      for (const t of transactions) {
        if (t.cashflow_group === "Income") {
          income += t.amount;
        } else {
          expenses += Math.abs(t.amount);
        }
      }

      const netCashflow = income - expenses;

      expect(income).toBe(5000);
      expect(expenses).toBe(2600);
      expect(netCashflow).toBe(2400);
    });

    it("should handle refunds correctly (positive amounts in expense categories)", () => {
      const transactions = [
        { cashflow_group: "Discretionary", amount: -100 },
        { cashflow_group: "Discretionary", amount: 50 },
        { cashflow_group: "Discretionary", amount: -75 },
      ];

      const total = transactions.reduce((sum, t) => sum + t.amount, 0);

      expect(total).toBe(-125);
    });

    it("should calculate net cashflow with business income and expenses", () => {
      const transactions = [
        { cashflow_group: "Income", amount: 5000 },
        { cashflow_group: "Business", amount: 1200 },
        { cashflow_group: "Business", amount: -300 },
        { cashflow_group: "Fixed", amount: -2000 },
      ];

      const income = transactions
        .filter((t) => t.cashflow_group === "Income")
        .reduce((sum, t) => sum + t.amount, 0);

      const business = transactions
        .filter((t) => t.cashflow_group === "Business")
        .reduce((sum, t) => sum + t.amount, 0);

      const fixed = transactions
        .filter((t) => t.cashflow_group === "Fixed")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const netCashflow = income + business - fixed;

      expect(income).toBe(5000);
      expect(business).toBe(900);
      expect(fixed).toBe(2000);
      expect(netCashflow).toBe(3900);
    });
  });

  describe("Safe-to-Spend Calculation", () => {
    it("should calculate weekly target from monthly budget", () => {
      const monthlyBudget = 1300;
      const weeklyTarget = monthlyBudget / 4.33;

      expect(weeklyTarget).toBeCloseTo(300.23, 2);
    });

    it("should calculate safe-to-spend correctly", () => {
      const weeklyTarget = 300;
      const spentThisWeek = 125;
      const safeToSpend = weeklyTarget - spentThisWeek;

      expect(safeToSpend).toBe(175);
    });

    it("should handle over-budget scenarios", () => {
      const weeklyTarget = 300;
      const spentThisWeek = 350;
      const safeToSpend = weeklyTarget - spentThisWeek;

      expect(safeToSpend).toBe(-50);
      expect(safeToSpend < 0).toBe(true);
    });
  });

  describe("Overspent Categories", () => {
    it("should identify overspent categories", () => {
      const budgetVsActual = [
        { category: "Groceries", budgeted: 600, actual: 650 },
        { category: "Restaurants", budgeted: 300, actual: 450 },
        { category: "Gas", budgeted: 200, actual: 180 },
      ];

      const overspent = budgetVsActual
        .map((item) => ({
          ...item,
          overspent: item.actual - item.budgeted,
        }))
        .filter((item) => item.overspent > 0)
        .sort((a, b) => b.overspent - a.overspent);

      expect(overspent).toHaveLength(2);
      expect(overspent[0].category).toBe("Restaurants");
      expect(overspent[0].overspent).toBe(150);
      expect(overspent[1].category).toBe("Groceries");
      expect(overspent[1].overspent).toBe(50);
    });

    it("should return empty array when all categories are within budget", () => {
      const budgetVsActual = [
        { category: "Groceries", budgeted: 600, actual: 550 },
        { category: "Restaurants", budgeted: 300, actual: 280 },
        { category: "Gas", budgeted: 200, actual: 180 },
      ];

      const overspent = budgetVsActual
        .map((item) => ({
          ...item,
          overspent: item.actual - item.budgeted,
        }))
        .filter((item) => item.overspent > 0);

      expect(overspent).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty transaction list", () => {
      const transactions: any[] = [];
      const total = transactions.reduce((sum, t) => sum + t.amount, 0);

      expect(total).toBe(0);
    });

    it("should handle zero amounts", () => {
      const transactions = [
        { amount: 0 },
        { amount: -100 },
        { amount: 0 },
      ];

      const total = transactions.reduce((sum, t) => sum + t.amount, 0);

      expect(total).toBe(-100);
    });

    it("should handle very small amounts (rounding)", () => {
      const transactions = [
        { amount: -0.01 },
        { amount: -0.02 },
        { amount: -0.03 },
      ];

      const total = transactions.reduce((sum, t) => sum + t.amount, 0);

      expect(total).toBeCloseTo(-0.06, 2);
    });
  });

  describe("Budget Calculations", () => {
    describe("Refund Handling", () => {
      it("should correctly reduce expense actuals with refunds (signed sums)", () => {
        // Scenario: $300 spent on groceries, $50 refund
        const transactions = [
          { life_category_id: "cat1", amount: -200, cashflow_group: "Variable Essentials" },
          { life_category_id: "cat1", amount: -100, cashflow_group: "Variable Essentials" },
          { life_category_id: "cat1", amount: 50, cashflow_group: "Variable Essentials" }, // refund
        ];

        // Use signed sum (not Math.abs)
        const actualSigned = transactions.reduce((sum, t) => sum + t.amount, 0);
        const actualDisplay = Math.abs(actualSigned);

        expect(actualSigned).toBe(-250); // -200 + -100 + 50
        expect(actualDisplay).toBe(250); // Display as positive for expenses
      });

      it("should handle full refund correctly", () => {
        const transactions = [
          { life_category_id: "cat1", amount: -100, cashflow_group: "Discretionary" },
          { life_category_id: "cat1", amount: 100, cashflow_group: "Discretionary" }, // full refund
        ];

        const actualSigned = transactions.reduce((sum, t) => sum + t.amount, 0);
        const actualDisplay = Math.abs(actualSigned);

        expect(actualSigned).toBe(0);
        expect(actualDisplay).toBe(0);
      });

      it("should handle refund larger than original purchase", () => {
        // Edge case: refund includes extra credit
        const transactions = [
          { life_category_id: "cat1", amount: -100, cashflow_group: "Discretionary" },
          { life_category_id: "cat1", amount: 120, cashflow_group: "Discretionary" },
        ];

        const actualSigned = transactions.reduce((sum, t) => sum + t.amount, 0);
        const actualDisplay = Math.abs(actualSigned);

        expect(actualSigned).toBe(20); // Net positive
        expect(actualDisplay).toBe(20);
      });
    });

    describe("Split Transaction Handling", () => {
      it("should exclude split parent and count only children", () => {
        const transactions = [
          { id: "parent", life_category_id: "cat1", amount: -150, is_split_parent: true },
          { id: "child1", life_category_id: "cat1", amount: -100, is_split_parent: false, parent_transaction_id: "parent" },
          { id: "child2", life_category_id: "cat2", amount: -50, is_split_parent: false, parent_transaction_id: "parent" },
        ];

        // Filter out split parents
        const validTransactions = transactions.filter((t) => !t.is_split_parent);

        expect(validTransactions).toHaveLength(2);
        expect(validTransactions.map((t) => t.id)).toEqual(["child1", "child2"]);

        // Aggregate by category
        const byCat: Record<string, number> = {};
        for (const t of validTransactions) {
          byCat[t.life_category_id] = (byCat[t.life_category_id] || 0) + t.amount;
        }

        expect(byCat["cat1"]).toBe(-100);
        expect(byCat["cat2"]).toBe(-50);
      });

      it("should handle split with refund on one child", () => {
        const transactions = [
          { id: "parent", life_category_id: "cat1", amount: -150, is_split_parent: true },
          { id: "child1", life_category_id: "cat1", amount: -100, is_split_parent: false },
          { id: "child2", life_category_id: "cat2", amount: -50, is_split_parent: false },
          { id: "refund", life_category_id: "cat1", amount: 30, is_split_parent: false }, // refund on cat1
        ];

        const validTransactions = transactions.filter((t) => !t.is_split_parent);

        const byCat: Record<string, number> = {};
        for (const t of validTransactions) {
          byCat[t.life_category_id] = (byCat[t.life_category_id] || 0) + t.amount;
        }

        expect(byCat["cat1"]).toBe(-70); // -100 + 30
        expect(byCat["cat2"]).toBe(-50);
      });
    });

    describe("Transfer Exclusion", () => {
      it("should exclude transfers from budget actuals", () => {
        const transactions = [
          { life_category_id: "cat1", amount: -100, is_transfer: false },
          { life_category_id: "cat1", amount: -500, is_transfer: true }, // transfer excluded
          { life_category_id: "cat1", amount: -50, is_transfer: false },
        ];

        const validTransactions = transactions.filter((t) => !t.is_transfer);
        const total = validTransactions.reduce((sum, t) => sum + t.amount, 0);

        expect(total).toBe(-150);
      });
    });

    describe("Cashflow Account Filtering", () => {
      it("should only include transactions from cashflow accounts", () => {
        const accounts = [
          { id: "acc1", include_in_cashflow: true },
          { id: "acc2", include_in_cashflow: false }, // 401k, excluded
          { id: "acc3", include_in_cashflow: true },
        ];

        const transactions = [
          { life_category_id: "cat1", amount: -100, account_id: "acc1" },
          { life_category_id: "cat1", amount: -200, account_id: "acc2" }, // excluded
          { life_category_id: "cat1", amount: -50, account_id: "acc3" },
        ];

        const cashflowAccountIds = new Set(
          accounts.filter((a) => a.include_in_cashflow).map((a) => a.id)
        );

        const validTransactions = transactions.filter((t) => cashflowAccountIds.has(t.account_id));
        const total = validTransactions.reduce((sum, t) => sum + t.amount, 0);

        expect(total).toBe(-150); // Only acc1 and acc3
      });
    });

    describe("Budget Variance Calculations", () => {
      it("should calculate variance correctly for expense categories", () => {
        const budgeted = 300;
        const actualSigned = -250; // Spent $250
        const actualDisplay = Math.abs(actualSigned);
        
        // For expenses: variance = budgeted - actual (positive is good)
        const variance = budgeted - actualDisplay;

        expect(variance).toBe(50); // Under budget by $50
      });

      it("should calculate variance correctly for income categories", () => {
        const budgeted = 5000;
        const actualSigned = 5500; // Earned $5500
        const actualDisplay = actualSigned; // Income stays positive
        
        // For income: variance = actual - budgeted (positive is good)
        const variance = actualDisplay - budgeted;

        expect(variance).toBe(500); // Over expected by $500
      });

      it("should handle overspent expense category", () => {
        const budgeted = 300;
        const actualSigned = -350; // Spent $350
        const actualDisplay = Math.abs(actualSigned);
        
        const variance = budgeted - actualDisplay;

        expect(variance).toBe(-50); // Over budget by $50
        expect(variance < 0).toBe(true); // Negative variance is bad for expenses
      });

      it("should handle under-earned income category", () => {
        const budgeted = 5000;
        const actualSigned = 4500; // Earned $4500
        const actualDisplay = actualSigned;
        
        const variance = actualDisplay - budgeted;

        expect(variance).toBe(-500); // Under expected by $500
        expect(variance < 0).toBe(true); // Negative variance is bad for income
      });
    });

    describe("Combined Filters", () => {
      it("should apply all filters together: cashflow accounts, no transfers, no split parents, signed sums", () => {
        const accounts = [
          { id: "acc1", include_in_cashflow: true },
          { id: "acc2", include_in_cashflow: false },
        ];

        const transactions = [
          { id: "1", life_category_id: "cat1", amount: -100, account_id: "acc1", is_transfer: false, is_split_parent: false, status: "posted" },
          { id: "2", life_category_id: "cat1", amount: -200, account_id: "acc2", is_transfer: false, is_split_parent: false, status: "posted" }, // excluded: not cashflow
          { id: "3", life_category_id: "cat1", amount: -50, account_id: "acc1", is_transfer: true, is_split_parent: false, status: "posted" }, // excluded: transfer
          { id: "4", life_category_id: "cat1", amount: -150, account_id: "acc1", is_transfer: false, is_split_parent: true, status: "posted" }, // excluded: split parent
          { id: "5", life_category_id: "cat1", amount: 30, account_id: "acc1", is_transfer: false, is_split_parent: false, status: "posted" }, // refund
          { id: "6", life_category_id: "cat1", amount: -75, account_id: "acc1", is_transfer: false, is_split_parent: false, status: "pending" }, // excluded: pending
        ];

        const cashflowAccountIds = new Set(
          accounts.filter((a) => a.include_in_cashflow).map((a) => a.id)
        );

        const validTransactions = transactions.filter(
          (t) =>
            cashflowAccountIds.has(t.account_id) &&
            !t.is_transfer &&
            !t.is_split_parent &&
            t.status === "posted"
        );

        expect(validTransactions).toHaveLength(2);
        expect(validTransactions.map((t) => t.id)).toEqual(["1", "5"]);

        const total = validTransactions.reduce((sum, t) => sum + t.amount, 0);
        expect(total).toBe(-70); // -100 + 30
      });
    });
  });
});
