import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseAssistantChat = vi.fn();

vi.mock("@/hooks/useAssistantChat", () => ({
  useAssistantChat: (...args: unknown[]) => mockUseAssistantChat(...args),
}));

import { AssistantChat } from "@/components/assistant/v2/AssistantChat";

describe("AssistantChat v2", () => {
  it("keeps textarea enabled when disconnected and shows reconnect", () => {
    const connect = vi.fn();
    mockUseAssistantChat.mockReturnValue({
      state: "disconnected",
      messages: [],
      conversationId: null,
      pendingQuestion: null,
      isStreaming: false,
      lastError: null,
      lastPongAt: null,
      connect,
      disconnect: vi.fn(),
      sendMessage: vi.fn(() => false),
      submitAnswer: vi.fn(() => false),
    });

    render(<AssistantChat projectName="global" initialConversationId={null} />);

    const textarea = screen.getByPlaceholderText("Ask the assistant…");
    expect(textarea).toBeEnabled();

    const reconnectButton = screen.getByRole("button", { name: "Reconnect" });
    expect(reconnectButton).toBeInTheDocument();
    fireEvent.click(reconnectButton);
    expect(connect).toHaveBeenCalled();

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();
  });

  it("submits when connected and send clicked", () => {
    const sendMessage = vi.fn(() => true);
    mockUseAssistantChat.mockReturnValue({
      state: "connected",
      messages: [],
      conversationId: "conv-1",
      pendingQuestion: null,
      isStreaming: false,
      lastError: null,
      lastPongAt: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendMessage,
      submitAnswer: vi.fn(() => false),
    });

    render(<AssistantChat projectName="global" />);
    fireEvent.change(screen.getByPlaceholderText("Ask the assistant…"), {
      target: { value: "hello assistant" },
    });

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);

    expect(sendMessage).toHaveBeenCalledWith("hello assistant");
  });

  it("calls onNewChat when button clicked", () => {
    mockUseAssistantChat.mockReturnValue({
      state: "connected",
      messages: [],
      conversationId: "conv-1",
      pendingQuestion: null,
      isStreaming: false,
      lastError: null,
      lastPongAt: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn(() => true),
      submitAnswer: vi.fn(() => false),
    });

    const onNewChat = vi.fn();
    render(<AssistantChat projectName="global" onNewChat={onNewChat} />);

    const newChatButton = screen.getByRole("button", { name: "New chat" });
    fireEvent.click(newChatButton);
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });
});
