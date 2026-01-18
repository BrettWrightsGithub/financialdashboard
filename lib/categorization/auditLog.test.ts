import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CategoryChangeSource } from "./auditLog";

// Create chainable mock
function createChainableMock() {
  const mock: any = {};
  const methods = ['from', 'select', 'eq', 'gte', 'lte', 'order', 'range', 'limit'];
  methods.forEach(method => {
    mock[method] = vi.fn(() => mock);
  });
  mock.rpc = vi.fn();
  mock.single = vi.fn();
  return mock;
}

const mockSupabase = createChainableMock();

vi.mock("../supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

// Import after mock setup
import {
  logCategoryChange,
  getAuditHistory,
  getAuditLogByDateRange,
  getAuditSummary,
} from "./auditLog";

describe("auditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logCategoryChange", () => {
    it("should log a category change via RPC", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: "log-id-123",
        error: null,
      });

      const result = await logCategoryChange({
        transactionId: "tx-123",
        previousCategoryId: "cat-old",
        newCategoryId: "cat-new",
        source: "manual" as CategoryChangeSource,
        changedBy: "user",
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("fn_log_category_change", {
        p_transaction_id: "tx-123",
        p_previous_category_id: "cat-old",
        p_new_category_id: "cat-new",
        p_change_source: "manual",
        p_rule_id: null,
        p_confidence_score: null,
        p_changed_by: "user",
        p_batch_id: null,
        p_notes: null,
      });
      expect(result.success).toBe(true);
      expect(result.logId).toBe("log-id-123");
    });

    it("should include optional fields when provided", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: "log-id-456",
        error: null,
      });

      await logCategoryChange({
        transactionId: "tx-456",
        previousCategoryId: null,
        newCategoryId: "cat-new",
        source: "rule" as CategoryChangeSource,
        ruleId: "rule-123",
        confidence: 0.95,
        changedBy: "system",
        batchId: "batch-789",
        notes: "Applied by rule engine",
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("fn_log_category_change", {
        p_transaction_id: "tx-456",
        p_previous_category_id: null,
        p_new_category_id: "cat-new",
        p_change_source: "rule",
        p_rule_id: "rule-123",
        p_confidence_score: 0.95,
        p_changed_by: "system",
        p_batch_id: "batch-789",
        p_notes: "Applied by rule engine",
      });
    });

    it("should return error on failure", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      const result = await logCategoryChange({
        transactionId: "tx-error",
        previousCategoryId: null,
        newCategoryId: "cat-new",
        source: "manual" as CategoryChangeSource,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("getAuditHistory", () => {
    it("should fetch audit history for a transaction", async () => {
      const mockData = [
        {
          id: "audit-1",
          transaction_id: "tx-123",
          previous_category_id: "cat-old",
          new_category_id: "cat-new",
          change_source: "manual",
          rule_id: null,
          confidence_score: null,
          changed_by: "user",
          batch_id: null,
          notes: null,
          is_reverted: false,
          created_at: "2025-01-15T10:00:00Z",
          prev_cat: { name: "Old Category" },
          new_cat: { name: "New Category" },
          rule: null,
        },
      ];

      // Reset and set up chain
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getAuditHistory("tx-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("category_audit_log");
      expect(result).toHaveLength(1);
      expect(result[0].transactionId).toBe("tx-123");
      expect(result[0].previousCategoryName).toBe("Old Category");
      expect(result[0].newCategoryName).toBe("New Category");
    });

    it("should return empty array on error", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: null, error: { message: "Query failed" } });

      const result = await getAuditHistory("tx-error");
      expect(result).toEqual([]);
    });
  });

  describe("getAuditLogByDateRange", () => {
    it("should fetch audit logs within date range", async () => {
      const mockData = [
        {
          id: "audit-1",
          transaction_id: "tx-1",
          change_source: "rule",
          created_at: "2025-01-15T10:00:00Z",
          previous_category_id: null,
          new_category_id: "cat-1",
          rule_id: null,
          confidence_score: null,
          changed_by: "system",
          batch_id: null,
          notes: null,
          is_reverted: false,
          prev_cat: null,
          new_cat: { name: "Category 1" },
          rule: null,
        },
        {
          id: "audit-2",
          transaction_id: "tx-2",
          change_source: "manual",
          created_at: "2025-01-16T10:00:00Z",
          previous_category_id: null,
          new_category_id: "cat-2",
          rule_id: null,
          confidence_score: null,
          changed_by: "user",
          batch_id: null,
          notes: null,
          is_reverted: false,
          prev_cat: null,
          new_cat: { name: "Category 2" },
          rule: null,
        },
      ];

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockReturnValue(mockSupabase);
      // Without options.offset, query ends with order() and is awaited directly
      mockSupabase.order.mockResolvedValueOnce({ data: mockData, error: null, count: 2 });

      const result = await getAuditLogByDateRange(
        new Date("2025-01-01"),
        new Date("2025-01-31")
      );

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter by source when provided", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      // When source filter is applied, eq() is the last in chain before await
      mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null, count: 0 });

      await getAuditLogByDateRange(
        new Date("2025-01-01"),
        new Date("2025-01-31"),
        { source: "rule" as CategoryChangeSource }
      );

      expect(mockSupabase.eq).toHaveBeenCalledWith("change_source", "rule");
    });
  });

  describe("getAuditSummary", () => {
    it("should return summary of audit activity", async () => {
      const mockData = [
        { change_source: "rule" },
        { change_source: "rule" },
        { change_source: "manual" },
        { change_source: "plaid" },
      ];

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      // First query ends with gte() for audit log
      mockSupabase.gte
        .mockResolvedValueOnce({ data: mockData, error: null })
        // Second query for batch count also ends with gte()
        .mockResolvedValueOnce({ count: 1, error: null });

      const result = await getAuditSummary(7);

      expect(result.totalChanges).toBe(4);
      expect(result.bySource.rule).toBe(2);
      expect(result.bySource.manual).toBe(1);
      expect(result.bySource.plaid).toBe(1);
    });

    it("should handle empty results", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ count: 0, error: null });

      const result = await getAuditSummary(7);

      expect(result.totalChanges).toBe(0);
      expect(result.bySource).toEqual({});
    });
  });
});
