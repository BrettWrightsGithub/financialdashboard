import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { parseRuleWithProvider } from "@/lib/assistant/provider";
import type {
  AssistantAction,
  AssistantActionType,
  AssistantChatMessage,
  AssistantChatRequest,
  AssistantChatResult,
  AssistantExpectedInflowPreview,
  AssistantSplitLinePreview,
} from "@/lib/assistant/types";
import type { ParsedRulePayload } from "@/lib/assistant/types";
import { logTelemetryEvent } from "@/lib/telemetry";

interface CategoryRow {
  id: string;
  name: string;
}

interface CounterpartyRow {
  id: string;
  name: string;
}

interface AccountRow {
  id: string;
  name: string;
  display_name: string | null;
  owner: string | null;
  institution_name: string | null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function parseAmountFromText(value: string): number | null {
  const match = value.match(/-?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function extractLatestUserMessage(messages: AssistantChatMessage[]): string {
  return (
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.content.trim())
      .filter(Boolean)
      .slice(-1)[0] || ""
  );
}

function buildLlmContextualPrompt(
  messages: AssistantChatMessage[],
  selectedTransaction: unknown,
  categories: CategoryRow[]
): string {
  const latestUserMessage = extractLatestUserMessage(messages);
  if (!latestUserMessage) return "";

  const history = messages
    .map((message) => ({ role: message.role, content: message.content.trim() }))
    .filter((message) => message.content.length > 0)
    .slice(-10)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const categoryContext = categories.length > 0
    ? `Available categories (pick from existing): ${categories.map((category) => category.name).join(", ")}.`
    : "";

  let txContext = "";
  if (selectedTransaction && typeof selectedTransaction === "object") {
    const tx = selectedTransaction as Record<string, unknown>;
    const description =
      (typeof tx.description_clean === "string" && tx.description_clean.trim()) ||
      (typeof tx.description_raw === "string" && tx.description_raw.trim()) ||
      "";

    const amount = typeof tx.amount === "number" ? tx.amount : null;
    txContext = description
      ? `Selected transaction context: ${description}${amount !== null ? ` (${amount})` : ""}.`
      : "";
  }

  return [txContext, categoryContext, history ? `Conversation history:\n${history}` : "", `Current user request: ${latestUserMessage}`]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function buildContextualPrompt(messages: AssistantChatMessage[], selectedTransaction: unknown): string {
  const latestUserMessage = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .slice(-1)[0] || "";
  const base = latestUserMessage;
  if (!base) return "";

  if (!selectedTransaction || typeof selectedTransaction !== "object") {
    return base;
  }

  const tx = selectedTransaction as Record<string, unknown>;
  const description =
    (typeof tx.description_clean === "string" && tx.description_clean.trim()) ||
    (typeof tx.description_raw === "string" && tx.description_raw.trim()) ||
    "";

  const amount = typeof tx.amount === "number" ? tx.amount : null;
  const txContext = description
    ? `Selected transaction context: ${description}${amount !== null ? ` (${amount})` : ""}.`
    : "";

  return `${txContext} ${base}`.trim();
}

function buildClarificationMessage(clarification?: string): string {
  if (clarification) return clarification;
  return "OK, what are the details? Please share merchant and category, plus optional amount/direction.";
}

function inferActionType(prompt: string, requested: AssistantChatRequest["actionHint"]): AssistantActionType {
  if (requested && requested !== "auto") return requested;

  const lower = prompt.toLowerCase();
  if (lower.includes("split") || lower.includes("receipt")) return "propose_split";
  if (lower.includes("inflow") || lower.includes("rent") || lower.includes("due")) return "create_expected_inflow";
  if (lower.includes("account") || lower.includes("rename") || lower.includes("owner")) return "suggest_account_updates";
  if (lower.includes("selected") || lower.includes("mark") || lower.includes("bulk")) return "bulk_edit_transactions";
  return "create_rule";
}

function matchCategoryByName(name: string | null, categories: CategoryRow[]): CategoryRow | null {
  if (!name) return null;
  const normalizedTarget = normalize(name);
  if (!normalizedTarget) return null;

  const exact = categories.find((category) => normalize(category.name) === normalizedTarget);
  if (exact) return exact;

  const tokens = normalizedTarget.split(" ").filter(Boolean);
  let best: { category: CategoryRow; score: number } | null = null;

  for (const category of categories) {
    const categoryNameNormalized = normalize(category.name);
    const score = tokens.reduce((acc, token) => acc + (categoryNameNormalized.includes(token) ? 1 : 0), 0);
    if (!best || score > best.score) {
      best = { category, score };
    }
  }

  return best && best.score > 0 ? best.category : null;
}

function parseBulkEditAction(prompt: string, selectedTransactionIds: string[], categories: CategoryRow[]): AssistantAction<"bulk_edit_transactions"> | null {
  if (!selectedTransactionIds.length) return null;

  const lower = prompt.toLowerCase();
  const matchedCategory = categories.find((category) => {
    const normalizedName = normalize(category.name);
    return normalizedName.length > 0 && lower.includes(normalizedName);
  });

  const isTransfer = lower.includes("transfer");
  const isPassThroughTrue = lower.includes("pass-through true") || lower.includes("pass through true");
  const isPassThroughFalse = lower.includes("pass-through false") || lower.includes("pass through false");
  const isBusinessTrue = lower.includes("business true") || lower.includes("mark as business");
  const isBusinessFalse = lower.includes("business false") || lower.includes("not business");

  if (matchedCategory) {
    const learnPayee = !lower.includes("no learn") && !lower.includes("don't learn");
    return {
      type: "bulk_edit_transactions",
      requires_confirm: true,
      preview: {
        transaction_ids: selectedTransactionIds,
        summary: `Assign ${selectedTransactionIds.length} selected transaction${selectedTransactionIds.length === 1 ? "" : "s"} to ${matchedCategory.name}${learnPayee ? " and learn payee" : ""}.`,
        payload: {
          action: "assign_category",
          transaction_ids: selectedTransactionIds,
          category_id: matchedCategory.id,
          learn_payee: learnPayee,
        },
      },
    };
  }

  const flags: { is_transfer?: boolean; is_pass_through?: boolean; is_business?: boolean } = {};
  if (isTransfer) flags.is_transfer = true;
  if (isPassThroughTrue) flags.is_pass_through = true;
  if (isPassThroughFalse) flags.is_pass_through = false;
  if (isBusinessTrue) flags.is_business = true;
  if (isBusinessFalse) flags.is_business = false;

  if (Object.keys(flags).length === 0) return null;

  const summaryParts: string[] = [];
  if (flags.is_transfer !== undefined) summaryParts.push(`transfer=${String(flags.is_transfer)}`);
  if (flags.is_pass_through !== undefined) summaryParts.push(`pass-through=${String(flags.is_pass_through)}`);
  if (flags.is_business !== undefined) summaryParts.push(`business=${String(flags.is_business)}`);

  return {
    type: "bulk_edit_transactions",
    requires_confirm: true,
    preview: {
      transaction_ids: selectedTransactionIds,
      summary: `Update ${selectedTransactionIds.length} selected transaction${selectedTransactionIds.length === 1 ? "" : "s"}: ${summaryParts.join(", ")}.`,
      payload: {
        action: "update_flags",
        transaction_ids: selectedTransactionIds,
        flags,
      },
    },
  };
}

function parseSplitLines(prompt: string, categories: CategoryRow[]): AssistantSplitLinePreview[] {
  const lines = prompt
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedLines: AssistantSplitLinePreview[] = [];

  for (const line of lines) {
    const amount = parseAmountFromText(line);
    if (amount === null) continue;

    const category = categories.find((candidate) => {
      const normalized = normalize(candidate.name);
      return normalized.length > 0 && normalize(line).includes(normalized);
    });

    const cleanDescription = line.replace(/-?\$?\s*[0-9]+(?:\.[0-9]{1,2})?/g, "").trim();

    parsedLines.push({
      amount,
      category_id: category?.id || null,
      category_name: category?.name || null,
      description: cleanDescription.length > 0 ? titleCase(cleanDescription) : null,
    });
  }

  return parsedLines;
}

function parseExpectedInflow(prompt: string, month: string, categories: CategoryRow[], counterparties: CounterpartyRow[]): AssistantExpectedInflowPreview | null {
  const amount = parseAmountFromText(prompt);

  const lower = prompt.toLowerCase();
  const monthly = lower.includes("monthly") ? "monthly" : null;
  const weekly = lower.includes("weekly") ? "weekly" : null;
  const recurrence = monthly || weekly || "one-time";

  const sourceMatch = prompt.match(/(?:add|create)?\s*(?:monthly|weekly)?\s*([a-z0-9 '&-]{3,40})\s*(?:from|for|,|\$)/i);
  let source = sourceMatch?.[1]?.trim() || "";
  if (!source) {
    if (lower.includes("salary") || lower.includes("paycheck") || lower.includes("payroll")) {
      source = "Salary";
    } else if (lower.includes("rent")) {
      source = "Rent";
    } else if (lower.includes("reimbursement")) {
      source = "Reimbursement";
    }
  }
  if (!source) source = "Expected inflow";

  const dayMatch = prompt.match(/(?:due|on)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  const expectedDate = dayMatch ? `${month}-${String(Math.max(1, Math.min(28, Number(dayMatch[1])))).padStart(2, "0")}` : null;

  const matchedCategory = categories.find((category) => normalize(prompt).includes(normalize(category.name)));
  const matchedCounterparty = counterparties.find((counterparty) => normalize(prompt).includes(normalize(counterparty.name)));

  return {
    source: titleCase(source),
    expected_amount: amount ?? 0,
    month,
    expected_date: expectedDate,
    recurrence,
    category_id: matchedCategory?.id || null,
    category_name: matchedCategory?.name || null,
    counterparty_id: matchedCounterparty?.id || null,
    counterparty_name: matchedCounterparty?.name || null,
    notes: null,
  };
}

function normalizeAccountLabel(account: AccountRow): string {
  const base = (account.display_name || account.name || "").trim();
  if (!base) return "Account";

  return base
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .replace(/checking/gi, "Checking")
    .replace(/savings/gi, "Savings")
    .replace(/credit\s*card/gi, "Credit Card")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function inferOwner(prompt: string, fallbackOwner: string | null): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("brett")) return "Brett";
  if (lower.includes("ashley")) return "Ashley";
  if (lower.includes("joint")) return "Joint";
  return fallbackOwner || "Joint";
}

async function parseCreateRule(prompt: string, categories: CategoryRow[]): Promise<{ result: AssistantChatResult; parsedRule: ParsedRulePayload | null }> {
  const parsed = await parseRuleWithProvider(prompt);
  if (!parsed.rule) {
    return {
      parsedRule: null,
      result: {
        status: "ask_details",
        assistant_message: buildClarificationMessage(parsed.clarification || parsed.response),
        clarification: parsed.clarification || parsed.response,
        rule: null,
        debug: parsed.debug,
      },
    };
  }

  const category = matchCategoryByName(parsed.rule.assign_category_name, categories);
  parsed.rule.assign_category_id = category?.id || null;

  if (!parsed.rule.assign_category_id) {
    return {
      parsedRule: parsed.rule,
      result: {
        status: "ask_details",
        assistant_message: `I parsed most of it, but I couldn't match category "${parsed.rule.assign_category_name}". Which existing category should I use?`,
        clarification: `Category "${parsed.rule.assign_category_name}" could not be matched.`,
        rule: parsed.rule,
        debug: parsed.debug,
      },
    };
  }

  return {
    parsedRule: parsed.rule,
    result: {
      status: "show_review",
      assistant_message: "OK, does this look good? Confirm and I will add the rule.",
      rule: parsed.rule,
      action: {
        type: "create_rule",
        preview: parsed.rule,
        requires_confirm: true,
      },
      debug: parsed.debug,
    },
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const track = async (
      status: number,
      debug: AssistantChatResult["debug"] | undefined,
      metadata: Record<string, unknown>
    ) => {
      const llm = debug?.llm_call;
      await logTelemetryEvent({
        eventType: "assistant_call",
        eventName: "assistant_chat",
        route: "/api/assistant/chat",
        httpMethod: "POST",
        httpStatus: status,
        latencyMs: Date.now() - startedAt,
        provider: llm?.provider ?? null,
        model: llm?.model ?? null,
        promptTokens: llm?.prompt_tokens ?? null,
        completionTokens: llm?.completion_tokens ?? null,
        totalTokens: llm?.total_tokens ?? null,
        userAgent: request.headers.get("user-agent"),
        metadata: {
          ...metadata,
          used_regex_fallback: debug?.used_regex_fallback ?? null,
          fallback_reason: debug?.fallback_reason ?? null,
        },
      });
    };

    const body = (await request.json()) as Partial<AssistantChatRequest>;
    const messages = Array.isArray(body?.messages) ? (body.messages as AssistantChatMessage[]) : [];
    const selectedTransaction = body?.selectedTransaction;
    const selectedTransactionIds = Array.isArray(body?.selectedTransactionIds)
      ? body.selectedTransactionIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const debugEnabled = body?.debug === true;
    const latestUserPrompt = extractLatestUserMessage(messages);
    const lightweightContextPrompt = buildContextualPrompt(messages, selectedTransaction);
    if (!latestUserPrompt) {
      const response: AssistantChatResult = {
        status: "ask_details",
        assistant_message: "How can I help? You can ask me to create a rule or preview a bulk edit command.",
        rule: null,
      };
      if (debugEnabled) {
        response.debug = { contextual_prompt: "" };
      }
      await track(200, response.debug, { assistant_status: response.status, action_type: "none" });
      return NextResponse.json(response);
    }

    const supabase = createServerSupabaseClient();
    const [{ data: categoriesRaw }, { data: counterpartiesRaw }, { data: accountsRaw }] = await Promise.all([
      supabase.from("categories").select("id, name").eq("is_active", true).limit(500),
      supabase.from("counterparties").select("id, name").eq("active", true).limit(500),
      supabase.from("accounts").select("id, name, display_name, owner, institution_name").eq("is_active", true).limit(500),
    ]);

    const categories = (categoriesRaw || []) as CategoryRow[];
    const counterparties = (counterpartiesRaw || []) as CounterpartyRow[];
    const accounts = (accountsRaw || []) as AccountRow[];
    const llmPrompt = buildLlmContextualPrompt(messages, selectedTransaction, categories);

    const actionType = inferActionType(latestUserPrompt, body.actionHint);

    if (actionType === "create_rule") {
      const { result, parsedRule } = await parseCreateRule(llmPrompt, categories);
      console.info("[assistant.chat]", {
        action_type: actionType,
        status: result.status,
        has_preview: Boolean(parsedRule),
      });
      if (debugEnabled) {
        result.debug = {
          contextual_prompt: llmPrompt,
          ...result.debug,
        };
      }
      // Keep legacy field behavior explicit.
      result.rule = parsedRule;
      await track(200, result.debug, { assistant_status: result.status, action_type: actionType });
      return NextResponse.json(result);
    }

    if (actionType === "bulk_edit_transactions") {
      const action = parseBulkEditAction(latestUserPrompt, selectedTransactionIds, categories);
      const response: AssistantChatResult = action
        ? {
            status: "show_review",
            assistant_message: "I prepared a bulk edit preview. Confirm to apply these selected-row updates.",
            rule: null,
            action,
          }
        : {
            status: "ask_details",
            assistant_message: selectedTransactionIds.length
              ? "I need a category or flag instruction. Example: 'Mark selected as Groceries and learn payee.'"
              : "Select one or more transactions first, then ask for a bulk command.",
            rule: null,
          };

      if (debugEnabled) {
        response.debug = { contextual_prompt: lightweightContextPrompt, parsed_payload: { action_type: actionType } };
      }
      console.info("[assistant.chat]", {
        action_type: actionType,
        status: response.status,
        has_preview: Boolean(action),
      });
      await track(200, response.debug, { assistant_status: response.status, action_type: actionType });
      return NextResponse.json(response);
    }

    if (actionType === "propose_split") {
      const parentAmount = Math.abs(typeof (selectedTransaction as { amount?: unknown })?.amount === "number"
        ? ((selectedTransaction as { amount: number }).amount)
        : 0);
      const lines = parseSplitLines(latestUserPrompt, categories);
      const total = lines.reduce((sum, line) => sum + line.amount, 0);
      const difference = Number((parentAmount - total).toFixed(2));

      const action: AssistantAction<"propose_split"> | null = lines.length > 0
        ? {
            type: "propose_split",
            requires_confirm: true,
            preview: {
              parent_amount: parentAmount,
              total_suggested: Number(total.toFixed(2)),
              difference,
              lines,
              validation_error:
                parentAmount > 0 && Math.abs(difference) >= 0.01
                  ? `Split total is off by ${difference > 0 ? "+" : ""}${difference.toFixed(2)}.`
                  : undefined,
            },
          }
        : null;

      const response: AssistantChatResult = action
        ? {
            status: "show_review",
            assistant_message: "I generated split suggestions. Review and apply to the split rows.",
            rule: null,
            action,
          }
        : {
            status: "ask_details",
            assistant_message: "Provide receipt-style lines with amounts, such as 'Groceries 42.10, Household 11.90'.",
            rule: null,
          };

      if (debugEnabled) {
        response.debug = { contextual_prompt: lightweightContextPrompt, parsed_payload: { action_type: actionType, lines_count: lines.length } };
      }
      console.info("[assistant.chat]", {
        action_type: actionType,
        status: response.status,
        lines_count: lines.length,
      });
      await track(200, response.debug, { assistant_status: response.status, action_type: actionType, lines_count: lines.length });
      return NextResponse.json(response);
    }

    if (actionType === "create_expected_inflow") {
      const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month)
        ? body.month
        : new Date().toISOString().slice(0, 7);
      const preview = parseExpectedInflow(latestUserPrompt, month, categories, counterparties);

      const response: AssistantChatResult = preview
        ? {
            status: "show_review",
            assistant_message: preview.expected_amount > 0
              ? "I parsed an expected inflow draft. Confirm to copy it into the form."
              : "I parsed source details. Add the expected amount, then confirm in the form.",
            rule: null,
            action: {
              type: "create_expected_inflow",
              requires_confirm: true,
              preview,
            },
          }
        : {
            status: "ask_details",
            assistant_message: "Please include amount and source. Example: 'Add monthly rent from Stephanie, $1200 due 1st'.",
            rule: null,
          };

      if (debugEnabled) {
        response.debug = { contextual_prompt: lightweightContextPrompt, parsed_payload: { action_type: actionType } };
      }
      console.info("[assistant.chat]", {
        action_type: actionType,
        status: response.status,
        has_preview: Boolean(preview),
      });
      await track(200, response.debug, { assistant_status: response.status, action_type: actionType, has_preview: Boolean(preview) });
      return NextResponse.json(response);
    }

    const ownerHint = inferOwner(latestUserPrompt, null);
    const suggestions = accounts.map((account) => ({
      account_id: account.id,
      provider_name: account.name,
      current_display_name: account.display_name || account.name,
      suggested_display_name: normalizeAccountLabel(account),
      current_owner: account.owner || "Joint",
      suggested_owner: ownerHint || account.owner || "Joint",
    }));

    const changedSuggestions = suggestions.filter(
      (item) => item.current_display_name !== item.suggested_display_name || item.current_owner !== item.suggested_owner
    );

    const response: AssistantChatResult = {
      status: "show_review",
      assistant_message: changedSuggestions.length
        ? `I prepared ${changedSuggestions.length} account update suggestion${changedSuggestions.length === 1 ? "" : "s"}.`
        : "I reviewed accounts and found no naming/owner changes to suggest.",
      rule: null,
      action: {
        type: "suggest_account_updates",
        requires_confirm: true,
        preview: {
          suggestions: changedSuggestions,
        },
      },
    };

    if (debugEnabled) {
      response.debug = { contextual_prompt: lightweightContextPrompt, parsed_payload: { action_type: actionType, suggestions: changedSuggestions.length } };
    }
    console.info("[assistant.chat]", {
      action_type: actionType,
      status: response.status,
      suggestions: changedSuggestions.length,
    });

    await track(200, response.debug, { assistant_status: response.status, action_type: actionType, suggestions: changedSuggestions.length });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Assistant chat error:", error);
    await logTelemetryEvent({
      eventType: "assistant_call",
      eventName: "assistant_chat",
      route: "/api/assistant/chat",
      httpMethod: "POST",
      httpStatus: 500,
      latencyMs: Date.now() - startedAt,
      userAgent: request.headers.get("user-agent"),
      metadata: { assistant_status: "error" },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process assistant chat" },
      { status: 500 }
    );
  }
}
