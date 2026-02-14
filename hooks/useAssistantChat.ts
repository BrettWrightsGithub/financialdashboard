"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssistantStructuredQuestion } from "@/lib/assistant/chatTypes";
import { trackClientEvent } from "@/lib/clientTelemetry";

export type AssistantChatLifecycleState = "connecting" | "connected" | "disconnected";

interface UseAssistantChatOptions {
  projectName: string;
  initialConversationId?: string | null;
  initialConversationTitle?: string;
  reconnectMaxAttempts?: number;
  reconnectBaseDelayMs?: number;
  pingIntervalMs?: number;
  createWebSocket?: (url: string) => WebSocket;
  onConversationIdChange?: (conversationId: string) => void;
  fetchConversationHistory?: (
    conversationId: string,
    projectName: string
  ) => Promise<{
    messages: Array<{
      id: string;
      role: string;
      content: string;
      message_type: string;
      metadata_json: Record<string, unknown> | null;
      created_at: string;
    }>;
  }>;
}

export interface AssistantChatTimelineMessage {
  id: string;
  role: "system" | "assistant" | "user" | "tool";
  content: string;
  messageType: "text" | "tool_call" | "question" | "answer";
  metadata: Record<string, unknown>;
  createdAt: string;
  isStreaming?: boolean;
}

interface UseAssistantChatResult {
  state: AssistantChatLifecycleState;
  messages: AssistantChatTimelineMessage[];
  conversationId: string | null;
  pendingQuestion: AssistantStructuredQuestion | null;
  isStreaming: boolean;
  lastError: string | null;
  lastPongAt: number | null;
  connect: (params?: { conversationId?: string | null; title?: string }) => void;
  disconnect: () => void;
  sendMessage: (content: string) => boolean;
  submitAnswer: (answer: { selectedOptionIds?: string[]; otherText?: string }) => boolean;
}

const DEFAULT_RECONNECT_MAX_ATTEMPTS = 3;
const DEFAULT_RECONNECT_BASE_DELAY_MS = 500;
const DEFAULT_PING_INTERVAL_MS = 20_000;

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getWsUrl(projectName: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/assistant/ws/${encodeURIComponent(projectName)}`;
}

function parseServerEvent(raw: string): { type: string; payload: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(raw) as { type?: unknown; payload?: unknown };
    if (
      !parsed ||
      typeof parsed.type !== "string" ||
      !parsed.payload ||
      typeof parsed.payload !== "object"
    ) {
      return null;
    }
    return {
      type: parsed.type,
      payload: parsed.payload as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function isTimelineRole(value: string): value is AssistantChatTimelineMessage["role"] {
  return value === "system" || value === "assistant" || value === "user" || value === "tool";
}

async function defaultFetchConversationHistory(conversationId: string, projectName: string) {
  const response = await fetch(
    `/api/assistant/conversations/${encodeURIComponent(conversationId)}?projectName=${encodeURIComponent(projectName)}`
  );
  if (!response.ok) {
    throw new Error("Failed to load conversation history");
  }
  return response.json() as Promise<{
    messages: Array<{
      id: string;
      role: string;
      content: string;
      message_type: string;
      metadata_json: Record<string, unknown> | null;
      created_at: string;
    }>;
  }>;
}

export function useAssistantChat(options: UseAssistantChatOptions): UseAssistantChatResult {
  const reconnectMaxAttempts = options.reconnectMaxAttempts ?? DEFAULT_RECONNECT_MAX_ATTEMPTS;
  const reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS;
  const pingIntervalMs = options.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
  const createWebSocket = options.createWebSocket ?? ((url: string) => new WebSocket(url));
  const fetchConversationHistory = options.fetchConversationHistory ?? defaultFetchConversationHistory;

  const [state, setState] = useState<AssistantChatLifecycleState>("disconnected");
  const [messages, setMessages] = useState<AssistantChatTimelineMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    options.initialConversationId || null
  );
  const [pendingQuestion, setPendingQuestion] = useState<AssistantStructuredQuestion | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastPongAt, setLastPongAt] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamMessageIdRef = useRef<string | null>(null);
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const startPayloadRef = useRef<{ conversationId?: string; title?: string }>({
    conversationId: options.initialConversationId || undefined,
    title: options.initialConversationTitle,
  });
  const loadedHistoryConversationIdRef = useRef<string | null>(null);

  const setConversation = useCallback(
    (nextConversationId: string | null) => {
      setConversationId(nextConversationId);
      if (nextConversationId && options.onConversationIdChange) {
        options.onConversationIdChange(nextConversationId);
      }
    },
    [options]
  );

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const appendMessage = useCallback((message: AssistantChatTimelineMessage) => {
    setMessages((previous) => [...previous, message]);
  }, []);

  const updateStreamingMessage = useCallback((chunk: string) => {
    const streamId = streamMessageIdRef.current;
    if (!streamId) {
      const messageId = createMessageId("assistant");
      streamMessageIdRef.current = messageId;
      setIsStreaming(true);
      setMessages((previous) => [
        ...previous,
        {
          id: messageId,
          role: "assistant",
          content: chunk,
          messageType: "text",
          metadata: {},
          createdAt: new Date().toISOString(),
          isStreaming: true,
        },
      ]);
      return;
    }

    setMessages((previous) =>
      previous.map((message) =>
        message.id === streamId
          ? {
              ...message,
              content: `${message.content}${chunk}`,
              isStreaming: true,
            }
          : message
      )
    );
  }, []);

  const finalizeStreamingMessage = useCallback(() => {
    const streamId = streamMessageIdRef.current;
    if (!streamId) {
      setIsStreaming(false);
      return;
    }
    setMessages((previous) =>
      previous.map((message) =>
        message.id === streamId
          ? {
              ...message,
              isStreaming: false,
            }
          : message
      )
    );
    streamMessageIdRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendJson = useCallback((data: unknown): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(data));
    return true;
  }, []);

  const emitEvent = useCallback((eventName: string, metadata?: Record<string, unknown>) => {
    void trackClientEvent(eventName, {
      metadata: {
        surface: "assistant_v2",
        project_name: options.projectName,
        ...metadata,
      },
    });
  }, [options.projectName]);

  const hydrateConversationHistory = useCallback(
    async (targetConversationId: string) => {
      if (loadedHistoryConversationIdRef.current === targetConversationId) {
        return;
      }
      try {
        const payload = await fetchConversationHistory(targetConversationId, options.projectName);
        const mappedMessages: AssistantChatTimelineMessage[] = (payload.messages || []).map(
          (message) => ({
            id: message.id,
            role: isTimelineRole(message.role) ? message.role : "assistant",
            content: message.content,
            messageType:
              message.message_type === "tool_call" ||
              message.message_type === "question" ||
              message.message_type === "answer"
                ? message.message_type
                : "text",
            metadata: message.metadata_json || {},
            createdAt: message.created_at,
          })
        );
        setMessages(mappedMessages);
        loadedHistoryConversationIdRef.current = targetConversationId;
      } catch {
        setLastError("Unable to load conversation history.");
      }
    },
    [fetchConversationHistory, options.projectName]
  );

  const attachSocketHandlers = useCallback(
    (socket: WebSocket) => {
      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setState("connected");
        setLastError(null);
        emitEvent("assistant_v2_connected");
        pingIntervalRef.current = window.setInterval(() => {
          sendJson({
            type: "ping",
            payload: { timestamp: Date.now() },
          });
        }, pingIntervalMs);

        sendJson({
          type: "start",
          payload: {
            conversation_id: startPayloadRef.current.conversationId,
            title: startPayloadRef.current.title,
          },
        });
      };

      socket.onmessage = (event) => {
        const raw = typeof event.data === "string" ? event.data : String(event.data || "");
        const parsed = parseServerEvent(raw);
        if (!parsed) {
          setLastError("Received invalid server event.");
          return;
        }

        if (parsed.type === "conversation_created") {
          const id = typeof parsed.payload.conversation_id === "string"
            ? parsed.payload.conversation_id
            : null;
          if (id) {
            startPayloadRef.current.conversationId = id;
            setConversation(id);
            loadedHistoryConversationIdRef.current = id;
            emitEvent("assistant_v2_conversation_created", { conversation_id: id });
          }
          return;
        }

        if (parsed.type === "connected") {
          const id = typeof parsed.payload.conversation_id === "string"
            ? parsed.payload.conversation_id
            : null;
          if (id) {
            startPayloadRef.current.conversationId = id;
            setConversation(id);
            void hydrateConversationHistory(id);
            emitEvent("assistant_v2_connected_session", { conversation_id: id });
          }
          return;
        }

        if (parsed.type === "text") {
          const chunk = typeof parsed.payload.chunk === "string" ? parsed.payload.chunk : "";
          if (chunk) {
            if (!streamMessageIdRef.current) {
              emitEvent("assistant_v2_stream_started");
            }
            updateStreamingMessage(chunk);
          }
          return;
        }

        if (parsed.type === "response_done") {
          finalizeStreamingMessage();
          emitEvent("assistant_v2_response_done");
          return;
        }

        if (parsed.type === "tool_call") {
          const toolName =
            typeof parsed.payload.tool_name === "string" ? parsed.payload.tool_name : "tool_call";
          appendMessage({
            id: createMessageId("tool"),
            role: "tool",
            content: toolName,
            messageType: "tool_call",
            metadata: parsed.payload,
            createdAt: new Date().toISOString(),
          });
          emitEvent("assistant_v2_tool_call", { tool_name: toolName });
          return;
        }

        if (parsed.type === "question") {
          const questionCandidate = parsed.payload.question;
          if (
            questionCandidate &&
            typeof questionCandidate === "object" &&
            typeof (questionCandidate as Record<string, unknown>).id === "string" &&
            typeof (questionCandidate as Record<string, unknown>).prompt === "string"
          ) {
            const question = questionCandidate as AssistantStructuredQuestion;
            setPendingQuestion(question);
            appendMessage({
              id: createMessageId("question"),
              role: "assistant",
              content: question.prompt,
              messageType: "question",
              metadata: { question },
              createdAt: new Date().toISOString(),
            });
            emitEvent("assistant_v2_question_shown", { question_id: question.id });
          }
          return;
        }

        if (parsed.type === "error") {
          const message =
            typeof parsed.payload.message === "string"
              ? parsed.payload.message
              : "Assistant connection error";
          setLastError(message);
          appendMessage({
            id: createMessageId("error"),
            role: "system",
            content: message,
            messageType: "text",
            metadata: parsed.payload,
            createdAt: new Date().toISOString(),
          });
          emitEvent("assistant_v2_error", { message });
          return;
        }

        if (parsed.type === "pong") {
          const timestamp =
            typeof parsed.payload.timestamp === "number" ? parsed.payload.timestamp : Date.now();
          setLastPongAt(timestamp);
        }
      };

      socket.onclose = () => {
        clearTimers();
        wsRef.current = null;
        finalizeStreamingMessage();
        setState("disconnected");
        emitEvent("assistant_v2_disconnected", {
          reconnect_enabled: shouldReconnectRef.current,
          reconnect_attempts: reconnectAttemptsRef.current,
        });
        if (!shouldReconnectRef.current) {
          return;
        }

        if (reconnectAttemptsRef.current >= reconnectMaxAttempts) {
          setLastError("Unable to reconnect to assistant.");
          emitEvent("assistant_v2_reconnect_failed");
          return;
        }

        const delay = reconnectBaseDelayMs * 2 ** reconnectAttemptsRef.current;
        reconnectAttemptsRef.current += 1;
        setState("connecting");
        reconnectTimeoutRef.current = window.setTimeout(() => {
          const ws = createWebSocket(getWsUrl(options.projectName));
          wsRef.current = ws;
          attachSocketHandlers(ws);
        }, delay);
      };

      socket.onerror = () => {
        setLastError("Assistant socket error.");
        emitEvent("assistant_v2_socket_error");
      };
    },
    [
      appendMessage,
      clearTimers,
      createWebSocket,
      emitEvent,
      finalizeStreamingMessage,
      options.projectName,
      pingIntervalMs,
      reconnectBaseDelayMs,
      reconnectMaxAttempts,
      sendJson,
      setConversation,
      hydrateConversationHistory,
      updateStreamingMessage,
    ]
  );

  const connect = useCallback(
    (params?: { conversationId?: string | null; title?: string }) => {
      const current = wsRef.current;
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (params && "conversationId" in params) {
        const nextConversationId = params.conversationId || null;
        startPayloadRef.current.conversationId = nextConversationId || undefined;
        setConversation(nextConversationId);
        if (!nextConversationId) {
          loadedHistoryConversationIdRef.current = null;
          setMessages([]);
        }
      }
      if (params?.title) {
        startPayloadRef.current.title = params.title;
      }

      shouldReconnectRef.current = true;
      clearTimers();
      setState("connecting");
      emitEvent("assistant_v2_connect_attempt", {
        has_conversation_id: Boolean(startPayloadRef.current.conversationId),
      });
      const ws = createWebSocket(getWsUrl(options.projectName));
      wsRef.current = ws;
      attachSocketHandlers(ws);
    },
    [attachSocketHandlers, clearTimers, createWebSocket, emitEvent, options.projectName, setConversation]
  );

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearTimers();
    setPendingQuestion(null);
    finalizeStreamingMessage();
    setState("disconnected");
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "manual disconnect");
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    emitEvent("assistant_v2_disconnect_manual");
  }, [clearTimers, emitEvent, finalizeStreamingMessage]);

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      appendMessage({
        id: createMessageId("user"),
        role: "user",
        content: trimmed,
        messageType: "text",
        metadata: {},
        createdAt: new Date().toISOString(),
      });
      emitEvent("assistant_v2_send");

      return sendJson({
        type: "message",
        payload: {
          content: trimmed,
        },
      });
    },
    [appendMessage, emitEvent, sendJson]
  );

  const submitAnswer = useCallback(
    (answer: { selectedOptionIds?: string[]; otherText?: string }) => {
      if (!pendingQuestion) return false;
      const selectedOptionIds = answer.selectedOptionIds || [];
      const otherText = answer.otherText || "";

      if (selectedOptionIds.length === 0 && otherText.trim().length === 0) {
        return false;
      }

      appendMessage({
        id: createMessageId("answer"),
        role: "user",
        content: otherText.trim() || selectedOptionIds.join(", "),
        messageType: "answer",
        metadata: {
          question_id: pendingQuestion.id,
          selected_option_ids: selectedOptionIds,
          other_text: otherText,
        },
        createdAt: new Date().toISOString(),
      });

      const sent = sendJson({
        type: "answer",
        payload: {
          question_id: pendingQuestion.id,
          selected_option_ids: selectedOptionIds,
          other_text: otherText,
        },
      });

      if (sent) {
        setPendingQuestion(null);
        emitEvent("assistant_v2_answer_sent", { question_id: pendingQuestion.id });
      }
      return sent;
    },
    [appendMessage, emitEvent, pendingQuestion, sendJson]
  );

  useEffect(
    () => () => {
      shouldReconnectRef.current = false;
      clearTimers();
      loadedHistoryConversationIdRef.current = null;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && ws.readyState < WebSocket.CLOSING) {
        ws.close();
      }
    },
    [clearTimers]
  );

  return useMemo(
    () => ({
      state,
      messages,
      conversationId,
      pendingQuestion,
      isStreaming,
      lastError,
      lastPongAt,
      connect,
      disconnect,
      sendMessage,
      submitAnswer,
    }),
    [
      connect,
      conversationId,
      disconnect,
      isStreaming,
      lastError,
      lastPongAt,
      messages,
      pendingQuestion,
      sendMessage,
      state,
      submitAnswer,
    ]
  );
}
