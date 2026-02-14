import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockConversationTable, mockMessagesTable, mockSupabase } = vi.hoisted(() => {
  const mockConversationTable = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  const mockMessagesTable = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };

  mockConversationTable.select.mockImplementation(() => mockConversationTable);
  mockConversationTable.eq.mockImplementation(() => mockConversationTable);

  mockMessagesTable.select.mockImplementation(() => mockMessagesTable);
  mockMessagesTable.eq.mockImplementation(() => mockMessagesTable);

  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === "assistant_conversations") return mockConversationTable;
      if (table === "assistant_messages") return mockMessagesTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { mockConversationTable, mockMessagesTable, mockSupabase };
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

import { GET } from "./route";

describe("/api/assistant/conversations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads conversation and ordered messages", async () => {
    const conversation = {
      id: "conv-1",
      project_name: "transactions",
      title: "Conversation",
      created_at: "2026-02-09T00:00:00.000Z",
      updated_at: "2026-02-09T00:10:00.000Z",
    };
    const messages = [
      {
        id: "msg-1",
        conversation_id: "conv-1",
        role: "user",
        content: "Hi",
        message_type: "text",
        metadata_json: {},
        created_at: "2026-02-09T00:00:01.000Z",
      },
      {
        id: "msg-2",
        conversation_id: "conv-1",
        role: "assistant",
        content: "Hello",
        message_type: "text",
        metadata_json: {},
        created_at: "2026-02-09T00:00:02.000Z",
      },
    ];

    mockConversationTable.single.mockResolvedValueOnce({ data: conversation, error: null } as never);
    mockMessagesTable.order.mockResolvedValueOnce({ data: messages, error: null } as never);

    const request = new NextRequest(
      "http://localhost:3000/api/assistant/conversations/conv-1?projectName=transactions"
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: "conv-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ conversation, messages });
    expect(mockConversationTable.eq).toHaveBeenNthCalledWith(1, "id", "conv-1");
    expect(mockConversationTable.eq).toHaveBeenNthCalledWith(2, "project_name", "transactions");
    expect(mockMessagesTable.eq).toHaveBeenCalledWith("conversation_id", "conv-1");
    expect(mockMessagesTable.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("returns 404 when conversation is missing", async () => {
    mockConversationTable.single.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    } as never);

    const request = new NextRequest("http://localhost:3000/api/assistant/conversations/conv-404");
    const response = await GET(request, {
      params: Promise.resolve({ id: "conv-404" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "not found" });
  });
});
