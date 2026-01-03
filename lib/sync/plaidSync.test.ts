import { describe, it, expect, vi, beforeEach } from "vitest";

// Create chainable mock
function createChainableMock() {
  const mock: any = {};
  const methods = ['from', 'select', 'eq', 'order', 'upsert'];
  methods.forEach(method => {
    mock[method] = vi.fn(() => mock);
  });
  mock.single = vi.fn();
  return mock;
}

const mockSupabase = createChainableMock();

vi.mock("../supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

import {
  getSyncStatus,
  getSyncSummary,
  getLastSyncTime,
  triggerSync,
  updateSyncState,
} from "./plaidSync";

// Mock fetch for webhook tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("plaidSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable
    delete process.env.N8N_SYNC_WEBHOOK_URL;
  });

  describe("getSyncStatus", () => {
    it("should return sync status for an account", async () => {
      const mockData = {
        id: "sync-1",
        account_id: "acc-123",
        connection_id: "conn-456",
        cursor: "cursor-abc",
        last_sync_at: "2025-01-15T10:00:00Z",
        last_sync_status: "success",
        last_error: null,
        transactions_added: 5,
        transactions_modified: 2,
        transactions_removed: 0,
      };

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getSyncStatus("acc-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("sync_state");
      expect(mockSupabase.eq).toHaveBeenCalledWith("account_id", "acc-123");
      expect(result).not.toBeNull();
      expect(result?.accountId).toBe("acc-123");
      expect(result?.lastSyncStatus).toBe("success");
      expect(result?.transactionsAdded).toBe(5);
    });

    it("should return null if not found", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

      const result = await getSyncStatus("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getSyncSummary", () => {
    it("should return summary across all accounts", async () => {
      const now = new Date();
      const recentSync = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();

      const mockData = [
        {
          id: "sync-1",
          last_sync_at: recentSync,
          last_sync_status: "success",
          transactions_added: 10,
          transactions_modified: 3,
          transactions_removed: 1,
        },
        {
          id: "sync-2",
          last_sync_at: recentSync,
          last_sync_status: "success",
          transactions_added: 5,
          transactions_modified: 0,
          transactions_removed: 0,
        },
      ];

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getSyncSummary();

      expect(result.accountsSynced).toBe(2);
      expect(result.status).toBe("success");
      expect(result.recentTransactions.added).toBe(15);
      expect(result.recentTransactions.modified).toBe(3);
    });

    it("should return 'never' status if no syncs", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await getSyncSummary();

      expect(result.status).toBe("never");
      expect(result.accountsSynced).toBe(0);
    });

    it("should report error status if any account has error", async () => {
      const mockData = [
        { id: "sync-1", last_sync_at: new Date().toISOString(), last_sync_status: "success" },
        { id: "sync-2", last_sync_at: new Date().toISOString(), last_sync_status: "error" },
      ];

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getSyncSummary();
      expect(result.status).toBe("error");
    });

    it("should report in_progress if any sync is running", async () => {
      const mockData = [
        { id: "sync-1", last_sync_at: new Date().toISOString(), last_sync_status: "in_progress" },
        { id: "sync-2", last_sync_at: new Date().toISOString(), last_sync_status: "success" },
      ];

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getSyncSummary();
      expect(result.status).toBe("in_progress");
    });
  });

  describe("getLastSyncTime", () => {
    it("should return Date of last sync", async () => {
      const syncTime = "2025-01-15T10:00:00Z";
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({
        data: [{ last_sync_at: syncTime, last_sync_status: "success" }],
        error: null,
      });

      const result = await getLastSyncTime();

      expect(result).toBeInstanceOf(Date);
      // Compare timestamps instead of ISO strings (handles millisecond formatting)
      expect(result?.getTime()).toBe(new Date(syncTime).getTime());
    });

    it("should return null if never synced", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await getLastSyncTime();
      expect(result).toBeNull();
    });
  });

  describe("triggerSync", () => {
    it("should return error if webhook URL not configured", async () => {
      const result = await triggerSync();

      expect(result.triggered).toBe(false);
      expect(result.error).toBe("Sync webhook not configured");
    });

    it("should call webhook when configured", async () => {
      process.env.N8N_SYNC_WEBHOOK_URL = "https://n8n.example.com/webhook/plaid-sync";
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await triggerSync({ accountId: "acc-123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://n8n.example.com/webhook/plaid-sync",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(result.triggered).toBe(true);
    });

    it("should handle webhook failure", async () => {
      process.env.N8N_SYNC_WEBHOOK_URL = "https://n8n.example.com/webhook/plaid-sync";
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await triggerSync();

      expect(result.triggered).toBe(false);
      expect(result.error).toContain("500");
    });
  });

  describe("updateSyncState", () => {
    it("should upsert sync state", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.upsert.mockResolvedValueOnce({ error: null });

      const result = await updateSyncState("conn-123", {
        cursor: "new-cursor",
        status: "success",
        transactionsAdded: 10,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith("sync_state");
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: "conn-123",
          cursor: "new-cursor",
          last_sync_status: "success",
          transactions_added: 10,
        }),
        { onConflict: "connection_id" }
      );
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.upsert.mockResolvedValueOnce({ error: { message: "Database error" } });

      const result = await updateSyncState("conn-error", {
        status: "error",
        error: "Failed",
      });

      expect(result).toBe(false);
    });
  });
});
