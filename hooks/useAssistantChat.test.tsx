import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssistantChat } from "@/hooks/useAssistantChat";

class MockSocket {
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState = 0;
  public sent: string[] = [];

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  serverClose() {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }
}

describe("useAssistantChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("connects and sends start payload", () => {
    const sockets: MockSocket[] = [];
    const onConversationIdChange = vi.fn();
    const { result } = renderHook(() =>
      useAssistantChat({
        projectName: "transactions",
        createWebSocket: () => {
          const socket = new MockSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
        onConversationIdChange,
      })
    );

    act(() => {
      result.current.connect({ conversationId: "conv-1", title: "Test chat" });
    });
    expect(result.current.state).toBe("connecting");

    act(() => {
      sockets[0].open();
    });

    expect(result.current.state).toBe("connected");
    expect(JSON.parse(sockets[0].sent[0])).toEqual({
      type: "start",
      payload: {
        conversation_id: "conv-1",
        title: "Test chat",
      },
    });

    act(() => {
      sockets[0].message({
        type: "conversation_created",
        payload: { conversation_id: "conv-created" },
      });
    });

    expect(result.current.conversationId).toBe("conv-created");
    expect(onConversationIdChange).toHaveBeenCalledWith("conv-created");
  });

  it("disconnects manually", () => {
    const sockets: MockSocket[] = [];
    const { result } = renderHook(() =>
      useAssistantChat({
        projectName: "transactions",
        createWebSocket: () => {
          const socket = new MockSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
      })
    );

    act(() => {
      result.current.connect();
      sockets[0].open();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.state).toBe("disconnected");
    expect(sockets[0].readyState).toBe(3);
  });

  it("retries reconnect with exponential backoff up to max attempts", () => {
    vi.useFakeTimers();
    const sockets: MockSocket[] = [];
    const { result } = renderHook(() =>
      useAssistantChat({
        projectName: "transactions",
        reconnectMaxAttempts: 3,
        reconnectBaseDelayMs: 10,
        createWebSocket: () => {
          const socket = new MockSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
      })
    );

    act(() => {
      result.current.connect();
      sockets[0].open();
      sockets[0].serverClose();
    });

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(sockets).toHaveLength(2);
    act(() => {
      sockets[1].serverClose();
      vi.advanceTimersByTime(20);
    });

    expect(sockets).toHaveLength(3);
    act(() => {
      sockets[2].serverClose();
      vi.advanceTimersByTime(40);
    });

    expect(sockets).toHaveLength(4);
    act(() => {
      sockets[3].serverClose();
    });

    expect(result.current.lastError).toBe("Unable to reconnect to assistant.");
    expect(result.current.state).toBe("disconnected");
  });

  it("handles ping and pong", () => {
    vi.useFakeTimers();
    const sockets: MockSocket[] = [];
    const { result } = renderHook(() =>
      useAssistantChat({
        projectName: "transactions",
        pingIntervalMs: 1000,
        createWebSocket: () => {
          const socket = new MockSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
      })
    );

    act(() => {
      result.current.connect();
      sockets[0].open();
      vi.advanceTimersByTime(1000);
    });

    expect(JSON.parse(sockets[0].sent[1]).type).toBe("ping");

    act(() => {
      sockets[0].message({ type: "pong", payload: { timestamp: 12345 } });
    });

    expect(result.current.lastPongAt).toBe(12345);
  });

  it("assembles streamed assistant text and finalizes response", () => {
    const sockets: MockSocket[] = [];
    const { result } = renderHook(() =>
      useAssistantChat({
        projectName: "transactions",
        createWebSocket: () => {
          const socket = new MockSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
      })
    );

    act(() => {
      result.current.connect();
      sockets[0].open();
      result.current.sendMessage("hello");
    });

    act(() => {
      sockets[0].message({ type: "text", payload: { chunk: "Hello " } });
      sockets[0].message({ type: "text", payload: { chunk: "world" } });
      sockets[0].message({ type: "response_done", payload: {} });
    });

    const assistant = result.current.messages.find((message) => message.role === "assistant");
    expect(assistant?.content).toBe("Hello world");
    expect(assistant?.isStreaming).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it("tracks question state and submits answers", () => {
    const sockets: MockSocket[] = [];
    const { result } = renderHook(() =>
      useAssistantChat({
        projectName: "transactions",
        createWebSocket: () => {
          const socket = new MockSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
      })
    );

    act(() => {
      result.current.connect();
      sockets[0].open();
      sockets[0].message({
        type: "question",
        payload: {
          question: {
            id: "q-1",
            prompt: "Choose",
            required: true,
            multi_select: false,
            options: [{ id: "opt-1", label: "Option 1" }],
          },
        },
      });
    });

    expect(result.current.pendingQuestion?.id).toBe("q-1");

    let submitted = false;
    act(() => {
      submitted = result.current.submitAnswer({ selectedOptionIds: ["opt-1"] });
    });

    expect(submitted).toBe(true);
    expect(result.current.pendingQuestion).toBeNull();
    const answerEvent = JSON.parse(sockets[0].sent[sockets[0].sent.length - 1]);
    expect(answerEvent).toEqual({
      type: "answer",
      payload: {
        question_id: "q-1",
        selected_option_ids: ["opt-1"],
        other_text: "",
      },
    });
  });

  it("hydrates history when connected with existing conversation id", async () => {
    const sockets: MockSocket[] = [];
    const fetchConversationHistory = vi.fn(async () => ({
      messages: [
        {
          id: "m-1",
          role: "user",
          content: "Earlier",
          message_type: "text",
          metadata_json: {},
          created_at: "2026-02-09T00:00:00.000Z",
        },
      ],
    }));

    const { result } = renderHook(() =>
      useAssistantChat({
        projectName: "transactions",
        createWebSocket: () => {
          const socket = new MockSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
        fetchConversationHistory,
      })
    );

    await act(async () => {
      result.current.connect({ conversationId: "conv-1" });
      sockets[0].open();
      sockets[0].message({
        type: "connected",
        payload: { conversation_id: "conv-1" },
      });
      await Promise.resolve();
    });

    expect(fetchConversationHistory).toHaveBeenCalledWith("conv-1", "transactions");
    expect(result.current.messages[0]?.content).toBe("Earlier");
  });
});
