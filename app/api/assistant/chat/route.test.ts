import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockParseRuleWithProvider = vi.fn();

const categories = [
  { id: "cat-grocery", name: "Groceries" },
  { id: "cat-coffee", name: "Coffee" },
];

const counterparties = [{ id: "cp-1", name: "Stephanie" }];
const accounts = [{ id: "acc-1", name: "chase checking", display_name: null, owner: "Joint", institution_name: "Chase" }];

function buildQueryResult(data: unknown) {
  return {
    eq: vi.fn(() => ({
      limit: vi.fn(async () => ({ data, error: null })),
    })),
  };
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "categories") {
      return { select: vi.fn(() => buildQueryResult(categories)) };
    }
    if (table === "counterparties") {
      return { select: vi.fn(() => buildQueryResult(counterparties)) };
    }
    if (table === "accounts") {
      return { select: vi.fn(() => buildQueryResult(accounts)) };
    }
    return { select: vi.fn(() => buildQueryResult([])) };
  }),
};

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

vi.mock("@/lib/assistant/provider", () => ({
  parseRuleWithProvider: (...args: unknown[]) => mockParseRuleWithProvider(...args),
}));

import { POST } from "./route";

describe("/api/assistant/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseRuleWithProvider.mockResolvedValue({
      rule: {
        name: "Starbucks -> Coffee",
        description: "test",
        priority: 50,
        is_active: true,
        match_merchant_contains: "starbucks",
        match_merchant_exact: null,
        match_amount_min: null,
        match_amount_max: 20,
        match_direction: "outflow",
        assign_category_name: "Coffee",
        assign_category_id: null,
        assign_is_transfer: null,
        assign_is_pass_through: null,
      },
    });
  });

  it("returns ask_details for bulk commands without selected ids", async () => {
    const request = new NextRequest("http://localhost:3000/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({
        actionHint: "bulk_edit_transactions",
        messages: [{ role: "user", content: "Mark selected as Groceries" }],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ask_details");
    expect(body.action).toBeUndefined();
  });

  it("returns a bulk-edit preview for selected rows", async () => {
    const request = new NextRequest("http://localhost:3000/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({
        actionHint: "bulk_edit_transactions",
        selectedTransactionIds: ["tx-1", "tx-2"],
        messages: [{ role: "user", content: "Mark selected as groceries and learn payee" }],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("show_review");
    expect(body.action?.type).toBe("bulk_edit_transactions");
    expect(body.action?.preview?.payload?.action).toBe("assign_category");
    expect(body.action?.preview?.payload?.category_id).toBe("cat-grocery");
    expect(body.action?.preview?.transaction_ids).toEqual(["tx-1", "tx-2"]);
  });

  it("keeps create_rule backward-compatible", async () => {
    const request = new NextRequest("http://localhost:3000/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({
        actionHint: "create_rule",
        messages: [{ role: "user", content: "Categorize Starbucks under $20 as Coffee" }],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("show_review");
    expect(body.rule?.assign_category_id).toBe("cat-coffee");
    expect(body.action?.type).toBe("create_rule");
  });

  it("returns expected inflow draft even when amount is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({
        actionHint: "create_expected_inflow",
        month: "2026-02",
        messages: [{ role: "user", content: "Add my salary as expected income" }],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("show_review");
    expect(body.action?.type).toBe("create_expected_inflow");
    expect(body.action?.preview?.source).toContain("Salary");
    expect(body.action?.preview?.expected_amount).toBe(0);
  });
});
