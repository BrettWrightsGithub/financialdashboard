export type AssistantChatConnectionStatus = "connecting" | "connected" | "disconnected";

export type AssistantChatMessageRole = "system" | "assistant" | "user" | "tool";

export type AssistantChatMessageType = "text" | "tool_call" | "question" | "answer";

export interface AssistantConversation {
  id: string;
  project_name: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantConversationMessage {
  id: string;
  conversation_id: string;
  role: AssistantChatMessageRole;
  content: string;
  message_type: AssistantChatMessageType;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface AssistantQuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface AssistantStructuredQuestion {
  id: string;
  prompt: string;
  required: boolean;
  multi_select: boolean;
  options: AssistantQuestionOption[];
}

export type AssistantClientEventType = "start" | "message" | "answer" | "ping";

export type AssistantServerEventType =
  | "connected"
  | "conversation_created"
  | "text"
  | "tool_call"
  | "question"
  | "response_done"
  | "error"
  | "pong";

export interface AssistantClientEvent<TType extends AssistantClientEventType, TPayload> {
  type: TType;
  payload: TPayload;
}

export interface AssistantServerEvent<TType extends AssistantServerEventType, TPayload> {
  type: TType;
  payload: TPayload;
}
