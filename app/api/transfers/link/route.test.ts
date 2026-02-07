import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
};

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

import { POST, DELETE } from "./route";

describe("/api/transfers/link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.eq.mockResolvedValue({ error: null } as any);
  });

  it("links two transactions bidirectionally", async () => {
    const request = new NextRequest("http://localhost:3000/api/transfers/link", {
      method: "POST",
      body: JSON.stringify({ transaction_id: "tx-1", counterpart_id: "tx-2" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSupabase.update).toHaveBeenCalled();
  });

  it("unlinks a transfer pair", async () => {
    mockSupabase.single.mockResolvedValue({ data: { id: "tx-1", transfer_pair_id: "tx-2" }, error: null } as any);

    const request = new NextRequest("http://localhost:3000/api/transfers/link", {
      method: "DELETE",
      body: JSON.stringify({ transaction_id: "tx-1" }),
    });

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
