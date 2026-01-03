import { describe, it, expect, vi, beforeEach } from "vitest";

// Create chainable mock
function createChainableMock() {
  const mock: any = {};
  const methods = ['from', 'select', 'eq', 'ilike', 'gte', 'lte', 'gt', 'lt', 'order', 'limit'];
  methods.forEach(method => {
    mock[method] = vi.fn(() => mock);
  });
  mock.single = vi.fn();
  mock.rpc = vi.fn();
  return mock;
}

const mockSupabase = createChainableMock();

vi.mock("../supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

import {
  previewRuleApplication,
  applyRuleRetroactively,
  undoBatch,
  getBatches,
  getBatch,
} from "./retroactiveRules";

describe("retroactiveRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("previewRuleApplication", () => {
    it("should preview matching transactions for a rule", async () => {
      // Setup mock chain for rule fetch
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.ilike.mockReturnValue(mockSupabase);
      
      // First call: get rule
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "rule-123",
          name: "Starbucks Rule",
          match_merchant_contains: "starbucks",
          assign_category_id: "cat-coffee",
          categories: { name: "Coffee" },
        },
        error: null,
      });

      // Second call: get transactions
      mockSupabase.limit.mockResolvedValueOnce({
        data: [
          {
            id: "tx-1",
            date: "2025-01-15",
            description_raw: "STARBUCKS #1234",
            amount: -5.5,
            life_category_id: "cat-restaurants",
            category_locked: false,
            categories: { name: "Restaurants" },
          },
          {
            id: "tx-2",
            date: "2025-01-16",
            description_raw: "STARBUCKS #5678",
            amount: -6.25,
            life_category_id: null,
            category_locked: false,
            categories: null,
          },
        ],
        error: null,
      });

      const result = await previewRuleApplication("rule-123");

      expect(result).not.toBeNull();
      expect(result?.ruleId).toBe("rule-123");
      expect(result?.ruleName).toBe("Starbucks Rule");
      expect(result?.matchingTransactions).toHaveLength(2);
      expect(result?.totalMatching).toBe(2);
      expect(result?.wouldChange).toBe(2);
      expect(result?.wouldSkipLocked).toBe(0);
    });

    it("should count locked transactions separately", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.ilike.mockReturnValue(mockSupabase);
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "rule-123",
          name: "Test Rule",
          match_merchant_contains: "test",
          assign_category_id: "cat-new",
          categories: { name: "New Category" },
        },
        error: null,
      });

      mockSupabase.limit.mockResolvedValueOnce({
        data: [
          {
            id: "tx-1",
            date: "2025-01-15",
            description_raw: "TEST MERCHANT",
            amount: -10,
            life_category_id: "cat-old",
            category_locked: true,
            categories: { name: "Old" },
          },
          {
            id: "tx-2",
            date: "2025-01-16",
            description_raw: "TEST MERCHANT 2",
            amount: -20,
            life_category_id: "cat-old",
            category_locked: false,
            categories: { name: "Old" },
          },
        ],
        error: null,
      });

      const result = await previewRuleApplication("rule-123");

      expect(result?.wouldSkipLocked).toBe(1);
      expect(result?.wouldChange).toBe(1);
    });

    it("should return null if rule not found", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

      const result = await previewRuleApplication("nonexistent");
      expect(result).toBeNull();
    });

    it("should apply date range filter", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockReturnValue(mockSupabase);
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "rule-123",
          name: "Test Rule",
          assign_category_id: "cat-new",
          categories: { name: "New" },
        },
        error: null,
      });

      mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null });

      await previewRuleApplication("rule-123", {
        start: new Date("2025-01-01"),
        end: new Date("2025-01-31"),
      });

      expect(mockSupabase.gte).toHaveBeenCalledWith("date", "2025-01-01");
      expect(mockSupabase.lte).toHaveBeenCalledWith("date", "2025-01-31");
    });
  });

  describe("applyRuleRetroactively", () => {
    it("should apply rule via RPC and return results", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            batch_id: "batch-123",
            applied_count: 5,
            skipped_locked: 2,
          },
        ],
        error: null,
      });

      const result = await applyRuleRetroactively(
        "rule-123",
        ["tx-1", "tx-2", "tx-3"],
        "user"
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith("fn_apply_rule_retroactive", {
        p_rule_id: "rule-123",
        p_transaction_ids: ["tx-1", "tx-2", "tx-3"],
        p_created_by: "user",
      });
      expect(result?.batchId).toBe("batch-123");
      expect(result?.appliedCount).toBe(5);
      expect(result?.skippedLocked).toBe(2);
    });

    it("should return null on RPC error", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Rule not found" },
      });

      const result = await applyRuleRetroactively("bad-rule", ["tx-1"]);
      expect(result).toBeNull();
    });
  });

  describe("undoBatch", () => {
    it("should undo batch via RPC", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            success: true,
            transactions_reverted: 5,
            error: null,
          },
        ],
        error: null,
      });

      const result = await undoBatch("batch-123");

      expect(mockSupabase.rpc).toHaveBeenCalledWith("fn_undo_batch", {
        p_batch_id: "batch-123",
      });
      expect(result.success).toBe(true);
      expect(result.transactionsReverted).toBe(5);
    });

    it("should return error for already-undone batch", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            success: false,
            transactions_reverted: 0,
            error: "Batch already undone",
          },
        ],
        error: null,
      });

      const result = await undoBatch("batch-already-done");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Batch already undone");
    });

    it("should handle RPC failure", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      const result = await undoBatch("batch-error");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("getBatches", () => {
    it("should fetch batch list", async () => {
      const mockData = [
        {
          id: "batch-1",
          rule_id: "rule-123",
          operation_type: "rule_apply",
          applied_at: "2025-01-15T10:00:00Z",
          transaction_count: 10,
          date_range_start: null,
          date_range_end: null,
          is_undone: false,
          undone_at: null,
          description: "Applied Starbucks rule",
          categorization_rules: { name: "Starbucks Rule" },
        },
      ];

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      // Without options, query ends with .eq("is_undone", false)
      mockSupabase.eq.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getBatches();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("batch-1");
      expect(result[0].ruleName).toBe("Starbucks Rule");
      expect(result[0].isUndone).toBe(false);
    });

    it("should filter by ruleId", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null });

      await getBatches({ ruleId: "rule-123" });

      expect(mockSupabase.eq).toHaveBeenCalledWith("rule_id", "rule-123");
    });

    it("should exclude undone by default", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null });

      await getBatches();

      expect(mockSupabase.eq).toHaveBeenCalledWith("is_undone", false);
    });

    it("should include undone when requested", async () => {
      vi.clearAllMocks();
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null });

      await getBatches({ includeUndone: true });

      // eq with is_undone should NOT be called
      expect(mockSupabase.eq).not.toHaveBeenCalledWith("is_undone", false);
    });
  });

  describe("getBatch", () => {
    it("should fetch single batch by ID", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "batch-123",
          rule_id: "rule-456",
          operation_type: "rule_apply",
          applied_at: "2025-01-15T10:00:00Z",
          transaction_count: 5,
          date_range_start: "2025-01-01",
          date_range_end: "2025-01-31",
          is_undone: false,
          undone_at: null,
          description: "Test batch",
          categorization_rules: { name: "Test Rule" },
        },
        error: null,
      });

      const result = await getBatch("batch-123");

      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "batch-123");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("batch-123");
      expect(result?.ruleName).toBe("Test Rule");
    });

    it("should return null if batch not found", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

      const result = await getBatch("nonexistent");
      expect(result).toBeNull();
    });
  });
});
