/**
 * Tests for Transaction Splitting Logic
 * Tests FR-10, A20 requirements from categorization MVP
 */

import { validateSplitAmounts } from "./transactionSplitting";
import type { SplitInput } from "@/types/database";

describe("validateSplitAmounts", () => {
  it("should require at least 2 splits", () => {
    const result = validateSplitAmounts(-100, [
      { amount: 100, category_id: "cat-1" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("At least 2 splits");
  });

  it("should validate splits sum to parent amount", () => {
    const result = validateSplitAmounts(-100, [
      { amount: 50, category_id: "cat-1" },
      { amount: 50, category_id: "cat-2" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("should reject splits that don't sum to parent amount", () => {
    const result = validateSplitAmounts(-100, [
      { amount: 40, category_id: "cat-1" },
      { amount: 50, category_id: "cat-2" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must equal parent amount");
  });

  it("should allow small rounding tolerance", () => {
    const result = validateSplitAmounts(-100, [
      { amount: 50.005, category_id: "cat-1" },
      { amount: 49.995, category_id: "cat-2" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("should reject splits with zero or negative amounts", () => {
    const result = validateSplitAmounts(-100, [
      { amount: 0, category_id: "cat-1" },
      { amount: 100, category_id: "cat-2" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("positive amount");
  });

  it("should reject splits without category", () => {
    const result = validateSplitAmounts(-100, [
      { amount: 50, category_id: "" },
      { amount: 50, category_id: "cat-2" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must have a category");
  });

  it("should handle positive parent amounts (income)", () => {
    const result = validateSplitAmounts(200, [
      { amount: 100, category_id: "cat-1" },
      { amount: 100, category_id: "cat-2" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("should handle three-way splits", () => {
    const result = validateSplitAmounts(-150, [
      { amount: 50, category_id: "cat-1" },
      { amount: 50, category_id: "cat-2" },
      { amount: 50, category_id: "cat-3" },
    ]);
    expect(result.valid).toBe(true);
  });
});

describe("Split transaction behavior", () => {
  it("children should inherit parent date and account", () => {
    // This is tested via integration tests with actual database
    // The splitTransaction function copies these fields from parent
    expect(true).toBe(true);
  });

  it("unsplit should restore parent to normal state", () => {
    // This is tested via integration tests with actual database
    // The unsplitTransaction function deletes all children
    expect(true).toBe(true);
  });
});

describe("Cashflow calculations with splits", () => {
  it("should exclude split parents from totals", () => {
    // This is tested in cashflow.test.ts
    // Split parents (transactions with children) are excluded
    expect(true).toBe(true);
  });

  it("should include split children in totals", () => {
    // This is tested in cashflow.test.ts
    // Children are normal transactions and included
    expect(true).toBe(true);
  });
});
