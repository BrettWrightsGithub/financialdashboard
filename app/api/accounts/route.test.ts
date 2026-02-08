import { describe, it, expect, beforeEach } from "vitest";

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  order: vi.fn(),
};

const mockCreateServerSupabaseClient = vi.fn(() => mockSupabase);

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
    mockSupabase.order
      .mockImplementationOnce(() => mockSupabase)
      .mockResolvedValueOnce({ data: accounts, error: null } as any);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accounts });
    expect(mockSupabase.from).toHaveBeenCalledWith("accounts");
    expect(mockSupabase.select).toHaveBeenCalledWith("*");
    expect(mockSupabase.order).toHaveBeenNthCalledWith(1, "institution_name", { ascending: true });
    expect(mockSupabase.order).toHaveBeenNthCalledWith(2, "name", { ascending: true });
  });

  it("returns 500 when Supabase query fails", async () => {
    mockSupabase.order
      .mockImplementationOnce(() => mockSupabase)
      .mockResolvedValueOnce({ data: null, error: { message: "db exploded" } } as any);

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
});
