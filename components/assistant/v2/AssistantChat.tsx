"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { ChatMessage } from "./ChatMessage";
import { QuestionOptions } from "./QuestionOptions";

interface AssistantChatProps {
  projectName: string;
  initialConversationId?: string | null;
  conversationTitle?: string;
  onConversationIdChange?: (conversationId: string) => void;
  onNewChat?: () => void;
  connectionLabel?: string;
}

export function AssistantChat({
  projectName,
  initialConversationId = null,
  conversationTitle,
  onConversationIdChange,
  onNewChat,
  connectionLabel,
}: AssistantChatProps) {
  const {
    state,
    messages,
    pendingQuestion,
    isStreaming,
    connect,
    sendMessage,
    submitAnswer,
  } = useAssistantChat({
    projectName,
    initialConversationId,
    initialConversationTitle: conversationTitle,
    onConversationIdChange,
  });

  const [input, setInput] = useState("");
  const [awaitingAssistant, setAwaitingAssistant] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    connect({
      conversationId: initialConversationId,
      title: conversationTitle,
    });
  }, [connect, conversationTitle, initialConversationId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, pendingQuestion, awaitingAssistant]);

  useEffect(() => {
    const hasAssistantReply = messages.some((message) => message.role === "assistant");
    if (hasAssistantReply && !isStreaming) {
      setAwaitingAssistant(false);
    }
  }, [isStreaming, messages]);

  const thinking = useMemo(
    () => awaitingAssistant && !isStreaming,
    [awaitingAssistant, isStreaming]
  );

  const inputLockedByQuestion = Boolean(pendingQuestion);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const sent = sendMessage(trimmed);
    if (sent) {
      setInput("");
      setAwaitingAssistant(true);
    }
  };

  return (
    <section className="assistant-v2-chat" data-assistant-chat-v2 data-connection-state={state}>
      <div className="assistant-v2-chat-toolbar">
        <span className="assistant-v2-connection">{connectionLabel || state}</span>
        {state !== "connected" ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => connect({ conversationId: initialConversationId, title: conversationTitle })}
          >
            Reconnect
          </button>
        ) : null}
        {onNewChat ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={onNewChat}
          >
            New chat
          </button>
        ) : null}
      </div>

      <div ref={scrollContainerRef} className="assistant-v2-chat-scroll">
        {messages.length === 0 ? (
          <div className="assistant-v2-empty">Start a conversation with the assistant.</div>
        ) : null}
        {state !== "connected" ? (
          <div className="assistant-v2-system">
            Assistant is disconnected. You can type now; sending is enabled after reconnect.
          </div>
        ) : null}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {thinking ? <div className="assistant-v2-thinking">Assistant is thinking…</div> : null}
      </div>

      {pendingQuestion ? (
        <QuestionOptions
          question={pendingQuestion}
          onSubmit={(answer) => {
            const submitted = submitAnswer(answer);
            if (submitted) {
              setAwaitingAssistant(true);
            }
          }}
        />
      ) : null}

      <div className="assistant-v2-input-row">
        <textarea
          className="assistant-v2-textarea"
          rows={3}
          value={input}
          disabled={inputLockedByQuestion}
          placeholder={
            pendingQuestion
              ? "Answer the pending question above to continue."
              : "Ask the assistant…"
          }
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={state !== "connected" || inputLockedByQuestion || input.trim().length === 0}
          onClick={handleSend}
        >
          Send
        </button>
      </div>
    </section>
  );
}
