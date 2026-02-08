export interface ParsedRulePayload {
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  match_merchant_contains: string | null;
  match_merchant_exact: string | null;
  match_amount_min: number | null;
  match_amount_max: number | null;
  match_direction: "inflow" | "outflow" | null;
  assign_category_name: string | null;
  assign_category_id: string | null;
  assign_is_transfer: boolean | null;
  assign_is_pass_through: boolean | null;
}

export interface ParseRuleResult {
  rule: ParsedRulePayload | null;
  clarification?: string;
  response?: string;
  debug?: AssistantChatDebugInfo;
}

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AssistantChatStatus = "ask_details" | "show_review";

export type AssistantActionType =
  | "create_rule"
  | "bulk_edit_transactions"
  | "propose_split"
  | "create_expected_inflow"
  | "suggest_account_updates";

export interface AssistantBulkEditPreview {
  transaction_ids: string[];
  summary: string;
  payload: {
    action: "assign_category" | "update_flags" | "approve";
    transaction_ids: string[];
    category_id?: string;
    learn_payee?: boolean;
    flags?: {
      is_transfer?: boolean;
      is_pass_through?: boolean;
      is_business?: boolean;
    };
  };
}

export interface AssistantSplitLinePreview {
  amount: number;
  category_id: string | null;
  category_name: string | null;
  description: string | null;
}

export interface AssistantSplitPreview {
  parent_amount: number;
  total_suggested: number;
  difference: number;
  lines: AssistantSplitLinePreview[];
  validation_error?: string;
}

export interface AssistantExpectedInflowPreview {
  source: string;
  expected_amount: number;
  month: string;
  expected_date: string | null;
  recurrence: "monthly" | "weekly" | "one-time" | null;
  category_id: string | null;
  category_name: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  notes: string | null;
}

export interface AssistantAccountSuggestion {
  account_id: string;
  provider_name: string;
  current_display_name: string;
  suggested_display_name: string;
  current_owner: string;
  suggested_owner: string;
}

export interface AssistantAccountSuggestionsPreview {
  suggestions: AssistantAccountSuggestion[];
}

export interface AssistantActionPayloadMap {
  create_rule: ParsedRulePayload;
  bulk_edit_transactions: AssistantBulkEditPreview;
  propose_split: AssistantSplitPreview;
  create_expected_inflow: AssistantExpectedInflowPreview;
  suggest_account_updates: AssistantAccountSuggestionsPreview;
}

export interface AssistantAction<T extends AssistantActionType = AssistantActionType> {
  type: T;
  preview: AssistantActionPayloadMap[T];
  requires_confirm: boolean;
}

export interface AssistantChatRequest {
  messages: AssistantChatMessage[];
  selectedTransaction?: Record<string, unknown> | null;
  selectedTransactionIds?: string[];
  actionHint?: AssistantActionType | "auto";
  month?: string;
  debug?: boolean;
}

export interface AssistantLlmCallDebug {
  provider: "openai" | "anthropic";
  endpoint: string;
  model: string;
  request: Record<string, unknown>;
  status?: number;
  response?: unknown;
  error?: string;
}

export interface AssistantChatDebugInfo {
  contextual_prompt?: string;
  llm_call?: AssistantLlmCallDebug;
  used_regex_fallback?: boolean;
  fallback_reason?: string;
  parsed_payload?: Record<string, unknown> | null;
}

export interface AssistantChatResult {
  status: AssistantChatStatus;
  assistant_message: string;
  rule: ParsedRulePayload | null;
  action?: AssistantAction;
  clarification?: string;
  debug?: AssistantChatDebugInfo;
}
