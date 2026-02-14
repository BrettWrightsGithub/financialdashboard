import { describe, expect, it } from "vitest";
import type { AssistantConversationRepository } from "@/lib/assistant/wsSession";
import { createAssistantWsSession } from "@/lib/assistant/wsSession";

function buildRepository(): AssistantConversationRepository {
  let messageCount = 0;
  const conversations = new Map([
    [
      "conv-existing",
      {
        id: "conv-existing",
        project_name: "transactions",
        title: "Existing",
        created_at: "2026-02-09T00:00:00.000Z",
        updated_at: "2026-02-09T00:00:00.000Z",
      },
    ],
  ]);

  return {
    async createConversation(projectName: string, title?: string) {
      const id = "conv-created";
      const conversation = {
        id,
        project_name: projectName,
        title: title || "New conversation",
        created_at: "2026-02-09T00:00:00.000Z",
        updated_at: "2026-02-09T00:00:00.000Z",
      };
      conversations.set(id, conversation);
      return conversation;
    },
    async getConversation(id: string, projectName?: string) {
      const found = conversations.get(id);
      if (!found) return null;
      if (projectName && found.project_name !== projectName) return null;
      return found;
    },
    async insertMessage(message) {
      messageCount += 1;
      return {
        id: `msg-${messageCount}`,
        conversation_id: message.conversation_id,
        role: message.role,
        content: message.content,
        message_type: message.message_type,
        metadata_json: message.metadata_json,
        created_at: "2026-02-09T00:00:00.000Z",
      };
    },
  };
}

describe("assistant ws session", () => {
  it("creates conversation on start when id is not supplied", async () => {
    const session = await createAssistantWsSession({
      projectName: "transactions",
      repository: buildRepository(),
    });

    const events = await session.handleRawMessage(
      JSON.stringify({ type: "start", payload: { title: "New chat" } })
    );

    expect(events[0]).toMatchObject({
      type: "conversation_created",
      payload: {
        conversation_id: "conv-created",
        project_name: "transactions",
      },
    });
    expect(events[1]).toMatchObject({
      type: "connected",
      payload: {
        conversation_id: "conv-created",
        project_name: "transactions",
      },
    });
  });

  it("is reconnect-safe with existing conversation id", async () => {
    const session = await createAssistantWsSession({
      projectName: "transactions",
      repository: buildRepository(),
    });

    const events = await session.handleRawMessage(
      JSON.stringify({
        type: "start",
        payload: { conversation_id: "conv-existing" },
      })
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "connected",
      payload: { conversation_id: "conv-existing" },
    });
  });

  it("streams text, emits tool_call, question, and response_done", async () => {
    const session = await createAssistantWsSession({
      projectName: "transactions",
      repository: buildRepository(),
    });

    await session.handleRawMessage(
      JSON.stringify({ type: "start", payload: { conversation_id: "conv-existing" } })
    );

    const events = await session.handleRawMessage(
      JSON.stringify({
        type: "message",
        payload: { content: "Please create a rule and choose one option" },
      })
    );

    expect(events.some((event) => event.type === "tool_call")).toBe(true);
    expect(events.some((event) => event.type === "text")).toBe(true);
    expect(events.some((event) => event.type === "question")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "response_done" });
  });

  it("returns pong for ping", async () => {
    const session = await createAssistantWsSession({
      projectName: "transactions",
      repository: buildRepository(),
    });

    const events = await session.handleRawMessage(
      JSON.stringify({ type: "ping", payload: { timestamp: 123 } })
    );

    expect(events).toEqual([{ type: "pong", payload: { timestamp: 123 } }]);
  });

  it("rejects message before start", async () => {
    const session = await createAssistantWsSession({
      projectName: "transactions",
      repository: buildRepository(),
    });

    const events = await session.handleRawMessage(
      JSON.stringify({ type: "message", payload: { content: "Hi" } })
    );

    expect(events).toEqual([
      {
        type: "error",
        payload: {
          code: "not_started",
          message: "Send start event before messaging.",
        },
      },
    ]);
  });
});
