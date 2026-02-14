import type {
  AssistantConversation,
  AssistantConversationMessage,
  AssistantServerEvent,
} from "@/lib/assistant/chatTypes";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  chunkText,
  createErrorEvent,
  createPongEvent,
  maybeBuildQuestion,
  parseAssistantClientEvent,
} from "@/lib/assistant/wsProtocol";

type MessageInsertInput = {
  conversation_id: string;
  role: "system" | "assistant" | "user" | "tool";
  content: string;
  message_type: "text" | "tool_call" | "question" | "answer";
  metadata_json: Record<string, unknown>;
};

export interface AssistantConversationRepository {
  createConversation: (
    projectName: string,
    title?: string
  ) => Promise<AssistantConversation>;
  getConversation: (
    id: string,
    projectName?: string
  ) => Promise<AssistantConversation | null>;
  insertMessage: (message: MessageInsertInput) => Promise<AssistantConversationMessage>;
}

function normalizeTitle(value: string | undefined): string {
  if (!value) return "New conversation";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "New conversation";
}

function guessToolName(content: string): string | null {
  const lower = content.toLowerCase();
  if (lower.includes("rule")) return "create_rule";
  if (lower.includes("split")) return "propose_split";
  if (lower.includes("inflow")) return "create_expected_inflow";
  if (lower.includes("transfer")) return "bulk_edit_transactions";
  return null;
}

function buildAssistantText(content: string): string {
  const trimmed = content.trim();
  return `Acknowledged: ${trimmed}. I can proceed once you confirm or provide more detail.`;
}

async function buildSupabaseRepository(): Promise<AssistantConversationRepository> {
  const supabase = createServerSupabaseClient();

  return {
    async createConversation(projectName: string, title?: string) {
      const { data, error } = await supabase
        .from("assistant_conversations")
        .insert({
          project_name: projectName,
          title: normalizeTitle(title),
        })
        .select("id, project_name, title, created_at, updated_at")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "failed to create conversation");
      }

      return data as AssistantConversation;
    },

    async getConversation(id: string, projectName?: string) {
      let query = supabase
        .from("assistant_conversations")
        .select("id, project_name, title, created_at, updated_at")
        .eq("id", id);

      if (projectName) {
        query = query.eq("project_name", projectName);
      }

      const { data, error } = await query.single();
      if (error) return null;
      return data as AssistantConversation;
    },

    async insertMessage(message: MessageInsertInput) {
      const { data, error } = await supabase
        .from("assistant_messages")
        .insert(message)
        .select("id, conversation_id, role, content, message_type, metadata_json, created_at")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "failed to insert message");
      }

      return data as AssistantConversationMessage;
    },
  };
}

export interface AssistantWsSession {
  handleRawMessage: (raw: string) => Promise<Array<AssistantServerEvent<any, unknown>>>;
}

export async function createAssistantWsSession(options: {
  projectName: string;
  repository?: AssistantConversationRepository;
}): Promise<AssistantWsSession> {
  const repository = options.repository || (await buildSupabaseRepository());
  const pendingQuestions = new Set<string>();
  let conversationId: string | null = null;
  let started = false;

  async function ensureConversation(
    preferredConversationId: string | undefined,
    title: string | undefined
  ): Promise<Array<AssistantServerEvent<any, unknown>>> {
    if (preferredConversationId) {
      const existingConversation = await repository.getConversation(
        preferredConversationId,
        options.projectName
      );
      if (existingConversation) {
        conversationId = existingConversation.id;
        return [];
      }
    }

    const created = await repository.createConversation(options.projectName, title);
    conversationId = created.id;
    return [
      {
        type: "conversation_created",
        payload: {
          conversation_id: created.id,
          project_name: created.project_name,
          title: created.title,
        },
      },
    ];
  }

  return {
    async handleRawMessage(raw: string) {
      try {
        const event = parseAssistantClientEvent(raw);

        if (event.type === "ping") {
          return [createPongEvent(event.payload.timestamp || Date.now())];
        }

        if (event.type === "start") {
          const createEvents = await ensureConversation(
            event.payload.conversation_id,
            event.payload.title
          );
          started = true;
          return [
            ...createEvents,
            {
              type: "connected",
              payload: {
                conversation_id: conversationId,
                project_name: options.projectName,
              },
            },
          ];
        }

        if (!started || !conversationId) {
          return [createErrorEvent("not_started", "Send start event before messaging.")];
        }

        if (event.type === "message") {
          const incomingMessage = await repository.insertMessage({
            conversation_id: conversationId,
            role: "user",
            content: event.payload.content,
            message_type: "text",
            metadata_json: {},
          });

          const events: Array<AssistantServerEvent<any, unknown>> = [];
          const toolName = guessToolName(event.payload.content);
          if (toolName) {
            await repository.insertMessage({
              conversation_id: conversationId,
              role: "tool",
              content: toolName,
              message_type: "tool_call",
              metadata_json: { tool_name: toolName, status: "invoked" },
            });
            events.push({
              type: "tool_call",
              payload: {
                conversation_id: conversationId,
                message_id: incomingMessage.id,
                tool_name: toolName,
                status: "invoked",
              },
            });
          }

          const assistantContent = buildAssistantText(event.payload.content);
          const chunks = chunkText(assistantContent);
          chunks.forEach((chunk, index) => {
            events.push({
              type: "text",
              payload: {
                conversation_id: conversationId,
                chunk,
                chunk_index: index,
              },
            });
          });

          const assistantMessage = await repository.insertMessage({
            conversation_id: conversationId,
            role: "assistant",
            content: assistantContent,
            message_type: "text",
            metadata_json: {},
          });

          const question = maybeBuildQuestion(event.payload.content);
          if (question) {
            pendingQuestions.add(question.id);
            await repository.insertMessage({
              conversation_id: conversationId,
              role: "assistant",
              content: question.prompt,
              message_type: "question",
              metadata_json: { question },
            });
            events.push({
              type: "question",
              payload: {
                conversation_id: conversationId,
                question,
              },
            });
          }

          events.push({
            type: "response_done",
            payload: {
              conversation_id: conversationId,
              message_id: assistantMessage.id,
            },
          });

          return events;
        }

        if (event.type === "answer") {
          if (!pendingQuestions.has(event.payload.question_id)) {
            return [createErrorEvent("invalid_answer", "Unknown or expired question_id.")];
          }
          pendingQuestions.delete(event.payload.question_id);

          await repository.insertMessage({
            conversation_id: conversationId,
            role: "user",
            content: event.payload.other_text || event.payload.selected_option_ids?.join(", ") || "Answered",
            message_type: "answer",
            metadata_json: {
              question_id: event.payload.question_id,
              selected_option_ids: event.payload.selected_option_ids || [],
              other_text: event.payload.other_text || "",
            },
          });

          const assistantMessage = await repository.insertMessage({
            conversation_id: conversationId,
            role: "assistant",
            content: "Thanks, I have what I need.",
            message_type: "text",
            metadata_json: {},
          });

          return [
            {
              type: "text",
              payload: {
                conversation_id: conversationId,
                chunk: "Thanks, I have what I need.",
                chunk_index: 0,
              },
            },
            {
              type: "response_done",
              payload: {
                conversation_id: conversationId,
                message_id: assistantMessage.id,
              },
            },
          ];
        }

        return [createErrorEvent("invalid_event", "Unsupported event type.")];
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_event";
        if (message === "invalid_json") {
          return [createErrorEvent("invalid_json", "Malformed JSON payload.")];
        }
        if (message === "invalid_message") {
          return [createErrorEvent("invalid_message", "Message content is required.")];
        }
        if (message === "invalid_answer") {
          return [createErrorEvent("invalid_answer", "Answer payload is invalid.")];
        }
        return [createErrorEvent("invalid_event", "Unsupported client event.")];
      }
    },
  };
}
