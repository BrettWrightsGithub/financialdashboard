import type {
  AssistantServerEvent,
  AssistantStructuredQuestion,
} from "@/lib/assistant/chatTypes";

export type AssistantWsErrorCode =
  | "invalid_json"
  | "invalid_event"
  | "not_started"
  | "invalid_message"
  | "invalid_answer";

export type AssistantStartClientEvent = {
  type: "start";
  payload: {
    conversation_id?: string;
    title?: string;
  };
};

export type AssistantMessageClientEvent = {
  type: "message";
  payload: {
    content: string;
  };
};

export type AssistantAnswerClientEvent = {
  type: "answer";
  payload: {
    question_id: string;
    selected_option_ids?: string[];
    other_text?: string;
  };
};

export type AssistantPingClientEvent = {
  type: "ping";
  payload: {
    timestamp?: number;
  };
};

export type AssistantClientEvent =
  | AssistantStartClientEvent
  | AssistantMessageClientEvent
  | AssistantAnswerClientEvent
  | AssistantPingClientEvent;

export function parseAssistantClientEvent(input: string): AssistantClientEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("invalid_json");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid_event");
  }

  const candidate = parsed as Record<string, unknown>;
  const type = candidate.type;
  const payload = candidate.payload;

  if (typeof type !== "string" || !payload || typeof payload !== "object") {
    throw new Error("invalid_event");
  }

  if (type === "start") {
    const data = payload as Record<string, unknown>;
    if (data.conversation_id !== undefined && typeof data.conversation_id !== "string") {
      throw new Error("invalid_event");
    }
    if (data.title !== undefined && typeof data.title !== "string") {
      throw new Error("invalid_event");
    }
    return { type, payload: { conversation_id: data.conversation_id as string | undefined, title: data.title as string | undefined } };
  }

  if (type === "message") {
    const data = payload as Record<string, unknown>;
    if (typeof data.content !== "string" || data.content.trim().length === 0) {
      throw new Error("invalid_message");
    }
    return { type, payload: { content: data.content.trim() } };
  }

  if (type === "answer") {
    const data = payload as Record<string, unknown>;
    if (typeof data.question_id !== "string" || data.question_id.trim().length === 0) {
      throw new Error("invalid_answer");
    }
    if (
      data.selected_option_ids !== undefined &&
      (!Array.isArray(data.selected_option_ids) ||
        data.selected_option_ids.some((value) => typeof value !== "string"))
    ) {
      throw new Error("invalid_answer");
    }
    if (data.other_text !== undefined && typeof data.other_text !== "string") {
      throw new Error("invalid_answer");
    }
    return {
      type,
      payload: {
        question_id: data.question_id.trim(),
        selected_option_ids: (data.selected_option_ids as string[] | undefined) || [],
        other_text: (data.other_text as string | undefined) || "",
      },
    };
  }

  if (type === "ping") {
    const data = payload as Record<string, unknown>;
    const timestamp = typeof data.timestamp === "number" ? data.timestamp : Date.now();
    return { type, payload: { timestamp } };
  }

  throw new Error("invalid_event");
}

export function createErrorEvent(
  code: AssistantWsErrorCode,
  message: string
): AssistantServerEvent<"error", { code: AssistantWsErrorCode; message: string }> {
  return {
    type: "error",
    payload: { code, message },
  };
}

export function createPongEvent(timestamp: number): AssistantServerEvent<"pong", { timestamp: number }> {
  return {
    type: "pong",
    payload: { timestamp },
  };
}

export function chunkText(content: string, chunkSize = 28): string[] {
  if (content.length <= chunkSize) return [content];

  const chunks: string[] = [];
  let index = 0;
  while (index < content.length) {
    chunks.push(content.slice(index, index + chunkSize));
    index += chunkSize;
  }
  return chunks;
}

export function maybeBuildQuestion(prompt: string): AssistantStructuredQuestion | null {
  const lower = prompt.toLowerCase();
  if (!lower.includes("which") && !lower.includes("choose") && !lower.includes("select")) {
    return null;
  }

  return {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    prompt: "Choose how I should proceed",
    required: true,
    multi_select: false,
    options: [
      { id: "opt-confirm", label: "Proceed", description: "Continue with this action." },
      { id: "opt-revise", label: "Revise", description: "Refine before applying." },
    ],
  };
}
