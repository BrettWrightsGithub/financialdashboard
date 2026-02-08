import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockQuery, mockSupabase, mockCreateServerSupabaseClient } = vi.hoisted(() => {
  const mockQuery = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };

  mockQuery.update.mockImplementation(() => mockQuery);
  mockQuery.eq.mockImplementation(() => mockQuery);
  mockQuery.select.mockImplementation(() => mockQuery);

  const mockSupabase = {
    from: vi.fn(() => mockQuery),
  };

  return {
    mockQuery,
    mockSupabase,
    mockCreateServerSupabaseClient: vi.fn(() => mockSupabase),
  };
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

import { PATCH } from "./route";

describe("/api/accounts/[id] PATCH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockImplementation(() => mockQuery);
    mockQuery.update.mockImplementation(() => mockQuery);
    mockQuery.eq.mockImplementation(() => mockQuery);
    mockQuery.select.mockImplementation(() => mockQuery);
  });

  it("returns 400 when no editable fields are provided", async () => {
    const request = new Request("http://localhost/api/accounts/acct-1", {
      method: "PATCH",
      body: JSON.stringify({}),
    }) as any;

    const response = await PATCH(request, { params: Promise.resolve({ id: "acct-1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "At least one of display_name, owner, or subtype is required" });
  });

  it("updates display_name, owner, and subtype when columns exist", async () => {
    mockQuery.single.mockResolvedValueOnce({
      data: {
        id: "acct-1",
        display_name: "Main Checking",
        owner: "Brett",
        subtype: "checking",
        name: "Checking",
      },
      error: null,
    } as any);

    const request = new Request("http://localhost/api/accounts/acct-1", {
      method: "PATCH",
      body: JSON.stringify({ display_name: "Main Checking", owner: "Brett", subtype: "checking" }),
    }) as any;

    const response = await PATCH(request, { params: Promise.resolve({ id: "acct-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockQuery.update).toHaveBeenCalledWith({
      display_name: "Main Checking",
      owner: "Brett",
      subtype: "checking",
      updated_at: expect.any(String),
    });
    expect(body.account.display_name).toBe("Main Checking");
    expect(body.account.owner).toBe("Brett");
    expect(body.account.subtype).toBe("checking");
  });

  it("falls back to name when display_name column is missing", async () => {
    mockQuery.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Could not find the 'display_name' column of 'accounts' in the schema cache",
        },
      } as any)
      .mockResolvedValueOnce({
        data: { id: "acct-1", name: "Main Checking", owner: "Joint", subtype: "checking" },
        error: null,
      } as any);

    const request = new Request("http://localhost/api/accounts/acct-1", {
      method: "PATCH",
      body: JSON.stringify({ display_name: "Main Checking", owner: "Joint", subtype: "checking" }),
    }) as any;

    const response = await PATCH(request, { params: Promise.resolve({ id: "acct-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockQuery.update).toHaveBeenNthCalledWith(1, {
      display_name: "Main Checking",
      owner: "Joint",
      subtype: "checking",
      updated_at: expect.any(String),
    });
    expect(mockQuery.update).toHaveBeenNthCalledWith(2, {
      name: "Main Checking",
      owner: "Joint",
      subtype: "checking",
      updated_at: expect.any(String),
    });
    expect(body.account.display_name).toBe("Main Checking");
  });

  it("falls back to account_type when subtype column is missing", async () => {
    mockQuery.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "column accounts.subtype does not exist",
        },
      } as any)
      .mockResolvedValueOnce({
        data: { id: "acct-1", display_name: "Main Checking", account_type: "checking" },
        error: null,
      } as any);

    const request = new Request("http://localhost/api/accounts/acct-1", {
      method: "PATCH",
      body: JSON.stringify({ display_name: "Main Checking", subtype: "checking" }),
    }) as any;

    const response = await PATCH(request, { params: Promise.resolve({ id: "acct-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockQuery.update).toHaveBeenNthCalledWith(1, {
      display_name: "Main Checking",
      subtype: "checking",
      updated_at: expect.any(String),
    });
    expect(mockQuery.update).toHaveBeenNthCalledWith(2, {
      display_name: "Main Checking",
      account_type: "checking",
      updated_at: expect.any(String),
    });
    expect(body.account.subtype).toBe("checking");
  });
});
