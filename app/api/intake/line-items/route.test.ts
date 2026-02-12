import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateServerSupabaseClient,
  mockExtractionMaybeSingle,
  mockLineItemsDeleteEq,
  mockLineItemsInsert,
  mockAccountsLimit,
  mockTransactionsDeleteLike,
  mockTransactionsInsert,
  mockArtifactEq,
  mockMatchUpsert,
} = vi.hoisted(() => {
  const mockExtractionMaybeSingle = vi.fn();
  const mockLineItemsDeleteEq = vi.fn();
  const mockLineItemsInsert = vi.fn();
  const mockAccountsLimit = vi.fn();
  const mockTransactionsDeleteLike = vi.fn();
  const mockTransactionsInsert = vi.fn();
  const mockArtifactEq = vi.fn();
  const mockMatchUpsert = vi.fn();

  const mockFrom = vi.fn((table: string) => {
    if (table === "intake_extractions") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: mockExtractionMaybeSingle,
          }),
        }),
      };
    }

    if (table === "intake_line_items") {
      return {
        delete: () => ({
          eq: mockLineItemsDeleteEq,
        }),
        insert: mockLineItemsInsert,
      };
    }

    if (table === "accounts") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({
                limit: mockAccountsLimit,
              }),
            }),
          }),
        }),
      };
    }

    if (table === "transactions") {
      return {
        delete: () => ({
          eq: () => ({
            like: mockTransactionsDeleteLike,
          }),
        }),
        insert: mockTransactionsInsert,
      };
    }

    if (table === "intake_artifacts") {
      return {
        update: () => ({
          eq: mockArtifactEq,
        }),
      };
    }

    if (table === "intake_matches") {
      return {
        upsert: mockMatchUpsert,
      };
    }

    return {};
  });

  const mockCreateServerSupabaseClient = vi.fn(() => ({
    from: mockFrom,
  }));

  return {
    mockCreateServerSupabaseClient,
    mockExtractionMaybeSingle,
    mockLineItemsDeleteEq,
    mockLineItemsInsert,
    mockAccountsLimit,
    mockTransactionsDeleteLike,
    mockTransactionsInsert,
    mockArtifactEq,
    mockMatchUpsert,
  };
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

import { POST } from "./route";

describe("/api/intake/line-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractionMaybeSingle.mockResolvedValue({
      data: {
        id: "extraction-1",
        total_amount: 62.61,
        tax_amount: 3.24,
        shipping_amount: 0,
        merchant_name: "Smith's",
        transaction_date: "2026-01-06",
      },
      error: null,
    });
    mockLineItemsDeleteEq.mockResolvedValue({ error: null });
    mockLineItemsInsert.mockResolvedValue({ error: null });
    mockAccountsLimit.mockResolvedValue({
      data: [{ id: "account-1", provider_account_id: "manual-account-1" }],
      error: null,
    });
    mockTransactionsDeleteLike.mockResolvedValue({ error: null });
    mockTransactionsInsert.mockResolvedValue({ error: null });
    mockArtifactEq.mockResolvedValue({ error: null });
    mockMatchUpsert.mockResolvedValue({ error: null });
  });

  it("accepts line-item totals that reconcile after tax/shipping adjustments", async () => {
    const request = {
      json: async () => ({
        artifact_id: "artifact-1",
        allow_total_mismatch: false,
        line_items: [
          {
            line_index: 0,
            name: "Item A",
            description: "Item A",
            quantity: "1.000",
            unit_price: "59.37",
            line_total: "59.37",
            suggested_category_id: "",
            confirmed_category_id: "",
            category_confidence: "0.9",
          },
        ],
      }),
    } as any;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe("applied");
    expect(body.transactions_created).toBe(1);
    expect(body.totals.line_total).toBe(59.37);
    expect(body.totals.line_plus_tax_shipping_total).toBe(62.61);
    expect(body.totals.difference).toBe(0);
    expect(mockTransactionsInsert).toHaveBeenCalledTimes(1);
    expect(mockArtifactEq).toHaveBeenCalledWith("id", "artifact-1");
  });

  it("rejects mismatches when neither line-only nor adjusted totals reconcile", async () => {
    mockExtractionMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "extraction-1",
        total_amount: 80,
        tax_amount: 0,
        shipping_amount: 0,
        merchant_name: "Smith's",
        transaction_date: "2026-01-06",
      },
      error: null,
    });

    const request = {
      json: async () => ({
        artifact_id: "artifact-1",
        allow_total_mismatch: false,
        line_items: [
          {
            line_index: 0,
            name: "Item A",
            description: "Item A",
            quantity: "1.000",
            unit_price: "59.37",
            line_total: "59.37",
            suggested_category_id: "",
            confirmed_category_id: "",
            category_confidence: "0.9",
          },
        ],
      }),
    } as any;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Enable override to save anyway");
    expect(body.totals.line_difference).toBe(-20.63);
    expect(body.totals.adjusted_difference).toBe(-20.63);
    expect(mockTransactionsInsert).not.toHaveBeenCalled();
  });
});
