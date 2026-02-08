import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { parseRuleWithProvider } from "@/lib/assistant/provider";
import type { AssistantChatMessage, AssistantChatResult } from "@/lib/assistant/types";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function buildContextualPrompt(messages: AssistantChatMessage[], selectedTransaction: unknown): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);

  const base = userMessages.join(". ");
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? (body.messages as AssistantChatMessage[]) : [];
    const selectedTransaction = body?.selectedTransaction;

    const prompt = buildContextualPrompt(messages, selectedTransaction);
    if (!prompt) {
      const response: AssistantChatResult = {
        status: "ask_details",
        assistant_message: "How can I help? You can ask me to create a categorization rule.",
        rule: null,
      };
      return NextResponse.json(response);
    }

    const parsed = await parseRuleWithProvider(prompt);
    if (!parsed.rule) {
      const response: AssistantChatResult = {
        status: "ask_details",
        assistant_message: buildClarificationMessage(parsed.clarification || parsed.response),
        clarification: parsed.clarification || parsed.response,
        rule: null,
      };
      return NextResponse.json(response);
    }

    const supabase = createServerSupabaseClient();
    const categoryName = parsed.rule.assign_category_name;

    if (categoryName) {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .limit(500);

      const normalizedTarget = normalize(categoryName);
      const exact = (categories || []).find((category) => normalize(category.name) === normalizedTarget);

      if (exact) {
        parsed.rule.assign_category_id = exact.id;
      } else {
        const tokens = normalizedTarget.split(" ").filter(Boolean);
        let best: { id: string; score: number } | null = null;
        for (const category of categories || []) {
          const categoryNameNormalized = normalize(category.name);
          const score = tokens.reduce((acc, token) => acc + (categoryNameNormalized.includes(token) ? 1 : 0), 0);
          if (!best || score > best.score) {
            best = { id: category.id, score };
          }
        }
        parsed.rule.assign_category_id = best && best.score > 0 ? best.id : null;
      }
    }

    if (!parsed.rule.assign_category_id) {
      const response: AssistantChatResult = {
        status: "ask_details",
        assistant_message: `I parsed most of it, but I couldn't match category "${categoryName}". Which existing category should I use?`,
        clarification: `Category "${categoryName}" could not be matched.`,
        rule: parsed.rule,
      };
      return NextResponse.json(response);
    }

    const response: AssistantChatResult = {
      status: "show_review",
      assistant_message: "OK, does this look good? Confirm and I will add the rule.",
      rule: parsed.rule,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Assistant chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process assistant chat" },
      { status: 500 }
    );
  }
}
