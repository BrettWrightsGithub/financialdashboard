import { describe, expect, it } from "vitest";
import { calculatePriorityScore } from "./priorityScoring";

describe("calculatePriorityScore", () => {
  it("normalizes inputs and applies weighted formula", () => {
    const score = calculatePriorityScore({ frequency: 5, amount: 250, uncertainty: 0.5 });
    expect(score).toBeCloseTo(0.5, 4);
  });

  it("caps normalized values at 1", () => {
    const score = calculatePriorityScore({ frequency: 100, amount: 5000, uncertainty: 10 });
    expect(score).toBe(1);
  });
});
