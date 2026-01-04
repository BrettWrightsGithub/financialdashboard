import { describe, it, expect } from "vitest";

// Helper functions for budget calculations
function calculateRemaining(expected: number, actual: number): number {
  return expected - actual;
}

function calculatePercentUsed(expected: number, actual: number): number {
  if (expected === 0) return 0;
  return Math.round((actual / expected) * 100);
}

function calculateVariance(expected: number, actual: number, isIncome: boolean): number {
  return isIncome ? actual - expected : expected - actual;
}

function isOverBudget(expected: number, actual: number, isIncome: boolean): boolean {
  return isIncome ? actual < expected : actual > expected;
}

function getProgressColor(percentUsed: number, isOver: boolean): string {
  if (isOver) return "bg-red-500";
  if (percentUsed > 80) return "bg-yellow-500";
  return "bg-green-500";
}

function getVarianceColor(variance: number, isIncome: boolean): string {
  const isGood = isIncome ? variance >= 0 : variance <= 0;
  return isGood ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function formatAllocationStatus(totalIncome: number, totalAllocated: number): {
  status: "over" | "low" | "good";
  remaining: number;
  percentage: number;
} {
  const remaining = totalIncome - totalAllocated;
  const percentage = totalIncome > 0 ? (totalAllocated / totalIncome) * 100 : 0;
  
  let status: "over" | "low" | "good";
  if (remaining < 0) {
    status = "over";
  } else if (remaining < totalIncome * 0.1) {
    status = "low";
  } else {
    status = "good";
  }
  
  return { status, remaining, percentage };
}

describe("Budget Calculations", () => {
  describe("calculateRemaining", () => {
    it("calculates remaining budget for expenses", () => {
      expect(calculateRemaining(500, 300)).toBe(200);
      expect(calculateRemaining(500, 600)).toBe(-100);
      expect(calculateRemaining(0, 0)).toBe(0);
    });

    it("calculates remaining budget for income", () => {
      expect(calculateRemaining(3000, 3500)).toBe(-500);
      expect(calculateRemaining(3000, 2500)).toBe(500);
    });
  });

  describe("calculatePercentUsed", () => {
    it("calculates percentage used correctly", () => {
      expect(calculatePercentUsed(100, 50)).toBe(50);
      expect(calculatePercentUsed(100, 100)).toBe(100);
      expect(calculatePercentUsed(100, 150)).toBe(150);
      expect(calculatePercentUsed(0, 50)).toBe(0);
    });

    it("handles edge cases", () => {
      expect(calculatePercentUsed(100, 0)).toBe(0);
      expect(calculatePercentUsed(100, 1)).toBe(1);
      expect(calculatePercentUsed(100, 99)).toBe(99);
    });
  });

  describe("calculateVariance", () => {
    it("calculates variance for income categories", () => {
      expect(calculateVariance(3000, 3500, true)).toBe(500); // Good: earned more
      expect(calculateVariance(3000, 2500, true)).toBe(-500); // Bad: earned less
    });

    it("calculates variance for expense categories", () => {
      expect(calculateVariance(500, 400, false)).toBe(100); // Good: spent less
      expect(calculateVariance(500, 600, false)).toBe(-100); // Bad: spent more
    });
  });

  describe("isOverBudget", () => {
    it("identifies over budget for income", () => {
      expect(isOverBudget(3000, 2500, true)).toBe(true); // Under earned = over budget
      expect(isOverBudget(3000, 3500, true)).toBe(false); // Over earned = not over budget
    });

    it("identifies over budget for expenses", () => {
      expect(isOverBudget(500, 600, false)).toBe(true); // Spent more = over budget
      expect(isOverBudget(500, 400, false)).toBe(false); // Spent less = not over budget
    });
  });

  describe("getProgressColor", () => {
    it("returns correct colors based on budget status", () => {
      // Over budget
      expect(getProgressColor(120, true)).toBe("bg-red-500");
      
      // High usage but not over
      expect(getProgressColor(85, false)).toBe("bg-yellow-500");
      
      // Good usage
      expect(getProgressColor(50, false)).toBe("bg-green-500");
      
      // Edge cases
      expect(getProgressColor(80, false)).toBe("bg-green-500");
      expect(getProgressColor(81, false)).toBe("bg-yellow-500");
    });
  });

  describe("getVarianceColor", () => {
    it("returns correct colors for variance", () => {
      // Income: positive variance is good
      expect(getVarianceColor(500, true)).toBe("text-green-600 dark:text-green-400");
      expect(getVarianceColor(-500, true)).toBe("text-red-600 dark:text-red-400");
      
      // Expenses: negative variance is good
      expect(getVarianceColor(-100, false)).toBe("text-green-600 dark:text-green-400");
      expect(getVarianceColor(100, false)).toBe("text-red-600 dark:text-red-400");
      
      // Zero variance
      expect(getVarianceColor(0, true)).toBe("text-green-600 dark:text-green-400");
      expect(getVarianceColor(0, false)).toBe("text-green-600 dark:text-green-400");
    });
  });

  describe("formatAllocationStatus", () => {
    it("identifies over allocation", () => {
      const result = formatAllocationStatus(3000, 3500);
      expect(result.status).toBe("over");
      expect(result.remaining).toBe(-500);
      expect(result.percentage).toBe(116.67);
    });

    it("identifies low remaining buffer", () => {
      const result = formatAllocationStatus(3000, 2800);
      expect(result.status).toBe("low");
      expect(result.remaining).toBe(200);
      expect(result.percentage).toBe(93.33);
    });

    it("identifies good allocation", () => {
      const result = formatAllocationStatus(3000, 2000);
      expect(result.status).toBe("good");
      expect(result.remaining).toBe(1000);
      expect(result.percentage).toBe(66.67);
    });

    it("handles zero income edge case", () => {
      const result = formatAllocationStatus(0, 0);
      expect(result.status).toBe("good");
      expect(result.remaining).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("handles exact 10% remaining threshold", () => {
      const result = formatAllocationStatus(1000, 900);
      expect(result.status).toBe("low"); // Exactly 10% remaining = low
      expect(result.remaining).toBe(100);
      expect(result.percentage).toBe(90);
    });

    it("handles just over 10% remaining", () => {
      const result = formatAllocationStatus(1000, 899);
      expect(result.status).toBe("good"); // Just over 10% remaining = good
      expect(result.remaining).toBe(101);
      expect(result.percentage).toBe(89.9);
    });
  });
});

describe("Budget Calculation Edge Cases", () => {
  it("handles negative budget amounts", () => {
    expect(calculatePercentUsed(-100, -50)).toBe(50);
    expect(calculateRemaining(-100, -80)).toBe(-20);
  });

  it("handles very large numbers", () => {
    expect(calculatePercentUsed(1000000, 750000)).toBe(75);
    expect(calculateRemaining(1000000, 750000)).toBe(250000);
  });

  it("handles decimal precision", () => {
    expect(calculatePercentUsed(100, 33.33)).toBe(33);
    expect(calculatePercentUsed(100, 66.67)).toBe(67);
  });

  it("handles zero actual spending", () => {
    expect(calculatePercentUsed(500, 0)).toBe(0);
    expect(calculateRemaining(500, 0)).toBe(500);
    expect(calculateVariance(500, 0, false)).toBe(500); // Good: didn't spend anything
  });

  it("handles zero expected budget", () => {
    expect(calculatePercentUsed(0, 100)).toBe(0);
    expect(calculateRemaining(0, 100)).toBe(-100);
  });
});

describe("Budget Calculation Integration", () => {
  it("calculates complete budget scenario", () => {
    const income = 5000;
    const expenses = [
      { expected: 1500, actual: 1400, category: "Fixed" },
      { expected: 800, actual: 900, category: "Variable Essentials" },
      { expected: 500, actual: 450, category: "Discretionary" },
      { expected: 300, actual: 300, category: "Debt" },
    ];

    const totalExpected = expenses.reduce((sum, e) => sum + e.expected, 0);
    const totalActual = expenses.reduce((sum, e) => sum + e.actual, 0);

    expect(totalExpected).toBe(3100);
    expect(totalActual).toBe(3050);

    const allocationStatus = formatAllocationStatus(income, totalExpected);
    expect(allocationStatus.status).toBe("good");
    expect(allocationStatus.remaining).toBe(1900);

    // Check individual category calculations
    expenses.forEach(expense => {
      const remaining = calculateRemaining(expense.expected, expense.actual);
      const percentUsed = calculatePercentUsed(expense.expected, expense.actual);
      const variance = calculateVariance(expense.expected, expense.actual, false);
      const overBudget = isOverBudget(expense.expected, expense.actual, false);

      expect(percentUsed).toBeGreaterThanOrEqual(0);
      expect(typeof remaining).toBe("number");
      expect(typeof variance).toBe("number");
      expect(typeof overBudget).toBe("boolean");
    });
  });
});
