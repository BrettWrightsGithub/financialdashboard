import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
  };

  mockSupabase.from.mockImplementation(() => mockSupabase);
  mockSupabase.select.mockImplementation(() => mockSupabase);
  mockSupabase.eq.mockImplementation(() => mockSupabase);
  mockSupabase.order.mockImplementation(() => mockSupabase);
  mockSupabase.insert.mockImplementation(() => mockSupabase);

  return { mockSupabase };
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

import { GET, POST } from "./route";

describe("/api/assistant/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists conversations ordered by updated_at desc", async () => {
    const conversations = [
      {
        id: "conv-2",
        project_name: "transactions",
        title: "Most recent",
        created_at: "2026-02-09T00:00:00.000Z",
        updated_at: "2026-02-09T01:00:00.000Z",
      },
    ];
    mockSupabase.limit.mockResolvedValueOnce({ data: conversations, error: null } as never);

    const request = new NextRequest(
      "http://localhost:3000/api/assistant/conversations?projectName=transactions&limit=10"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ conversations });
    expect(mockSupabase.from).toHaveBeenCalledWith("assistant_conversations");
    expect(mockSupabase.eq).toHaveBeenCalledWith("project_name", "transactions");
    expect(mockSupabase.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(mockSupabase.limit).toHaveBeenCalledWith(10);
  });

  it("creates a conversation", async () => {
    const conversation = {
      id: "conv-1",
      project_name: "transactions",
      title: "Budget chat",
      created_at: "2026-02-09T00:00:00.000Z",
      updated_at: "2026-02-09T00:00:00.000Z",
    };
    mockSupabase.single.mockResolvedValueOnce({ data: conversation, error: null } as never);

    const request = new NextRequest("http://localhost:3000/api/assistant/conversations", {
      method: "POST",
      body: JSON.stringify({ projectName: "transactions", title: "Budget chat" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ conversation });
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      project_name: "transactions",
      title: "Budget chat",
    });
  });

  it("rejects missing projectName", async () => {
    const request = new NextRequest("http://localhost:3000/api/assistant/conversations");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "projectName is required" });
  });
});
