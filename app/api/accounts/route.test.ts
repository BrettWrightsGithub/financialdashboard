import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSupabase, mockCreateServerSupabaseClient } = vi.hoisted(() => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
  };

  mockSupabase.from.mockImplementation(() => mockSupabase);
  mockSupabase.select.mockImplementation(() => mockSupabase);

  return {
    mockSupabase,
    mockCreateServerSupabaseClient: vi.fn(() => mockSupabase),
  };
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

import { GET } from "./route";

describe("/api/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accounts on success", async () => {
    const accounts = [{ id: "acct-1", name: "Checking" }];
    mockSupabase.order.mockResolvedValueOnce({ data: accounts, error: null } as any);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      accounts: [
        {
          id: "acct-1",
          name: "Checking",
          display_name: "Checking",
          owner: "Joint",
          subtype: "other",
          institution_name: null,
        },
      ],
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("accounts");
    expect(mockSupabase.select).toHaveBeenCalledWith("*");
    expect(mockSupabase.order).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("returns 500 when Supabase query fails", async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: null, error: { message: "db exploded" } } as any);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "db exploded" });
  });

  it("returns 500 when client creation throws", async () => {
    mockCreateServerSupabaseClient.mockImplementationOnce(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" });
  });

  it("maps legacy institution field to institution_name", async () => {
    const accounts = [{ id: "acct-1", name: "Checking", institution: "Legacy Bank" }];
    mockSupabase.order.mockResolvedValueOnce({ data: accounts, error: null } as any);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      accounts: [
        {
          id: "acct-1",
          name: "Checking",
          institution: "Legacy Bank",
          display_name: "Checking",
          owner: "Joint",
          subtype: "other",
          institution_name: "Legacy Bank",
        },
      ],
    });
  });

  it("maps legacy account_type field to subtype", async () => {
    const accounts = [{ id: "acct-1", name: "Checking", account_type: "checking" }];
    mockSupabase.order.mockResolvedValueOnce({ data: accounts, error: null } as any);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accounts[0].subtype).toBe("checking");
  });
});
