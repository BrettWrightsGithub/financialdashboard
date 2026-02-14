import { describe, expect, it } from "vitest";
import {
  chunkText,
  createPongEvent,
  parseAssistantClientEvent,
} from "@/lib/assistant/wsProtocol";

describe("assistant ws protocol", () => {
  it("parses start events", () => {
    const parsed = parseAssistantClientEvent(
      JSON.stringify({
        type: "start",
        payload: { conversation_id: "conv-1", title: "Test" },
      })
    );

    expect(parsed).toEqual({
      type: "start",
      payload: { conversation_id: "conv-1", title: "Test" },
    });
  });

  it("rejects blank message payload", () => {
    expect(() =>
      parseAssistantClientEvent(
        JSON.stringify({
          type: "message",
          payload: { content: "   " },
        })
      )
    ).toThrowError("invalid_message");
  });

  it("chunks text into streaming segments", () => {
    const chunks = chunkText("abcdefghijklmnopqrstuvwxyz", 10);
    expect(chunks).toEqual(["abcdefghij", "klmnopqrst", "uvwxyz"]);
  });

  it("builds pong events", () => {
    expect(createPongEvent(42)).toEqual({
      type: "pong",
      payload: { timestamp: 42 },
    });
  });
});
