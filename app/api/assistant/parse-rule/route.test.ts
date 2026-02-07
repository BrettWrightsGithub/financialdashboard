import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  ilike: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  maybeSingle: vi.fn(() => mockSupabase),
};

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

vi.mock("@/lib/assistant/provider", () => ({
  parseRuleWithProvider: vi.fn(async () => ({
    rule: {
      name: "Starbucks -> Coffee",
      description: "test",
      priority: 50,
      is_active: true,
      match_merchant_contains: "starbucks",
      match_merchant_exact: null,
      match_amount_min: null,
      match_amount_max: 15,
      match_direction: "outflow",
      assign_category_name: "Coffee",
      assign_category_id: null,
      assign_is_transfer: null,
      assign_is_pass_through: null,
    },
  })),
}));

import { POST } from "./route";

describe("/api/assistant/parse-rule", () => {
  it("returns clarification when category cannot be matched", async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null } as any);

    const request = new NextRequest("http://localhost:3000/api/assistant/parse-rule", {
      method: "POST",
      body: JSON.stringify({ message: "Categorize Starbucks under $15 as Coffee" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.clarification).toContain("couldn't match category");
  });
});
