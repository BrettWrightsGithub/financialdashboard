import type { ParseRuleResult } from "./types";

type Provider = "openai" | "anthropic";

interface ProviderInput {
  message: string;
  provider: Provider;
  apiKey: string;
}

const SYSTEM_PROMPT = [
  "You are a strict transaction categorization rule parser.",
  "Return JSON only with fields: merchant, amount_min, amount_max, direction, category, priority, transfer.",
  "If details are missing, return clarification text in field clarification.",
].join(" ");

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callOpenAI(input: ProviderInput): Promise<Record<string, unknown> | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input.message },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return null;
  return safeJsonParse(content);
}

async function callAnthropic(input: ProviderInput): Promise<Record<string, unknown> | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: input.message }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.content?.[0]?.text;
  if (!content || typeof content !== "string") return null;
  return safeJsonParse(content);
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function regexFallback(message: string): Record<string, unknown> {
  const lower = message.toLowerCase();

  const merchantMatch = message.match(/(?:categorize|for|merchant|from)\s+([a-z0-9 .&'-]+?)\s+(?:as|under|over|to|into)/i);
  const providerMatch = message.match(/\b(venmo|zelle|paypal|cash app|apple cash|google pay)\b/i);
  const quotedKeyword = message.match(/["']([^"']+)["']/);
  const keywordMatch = message.match(/(?:have|with|contains?)\s+([a-z0-9 .&'-]+?)\s+(?:in|as|to|under|over|$)/i);
  const categoryMatch = message.match(/(?:as|to|into)\s+([a-z][a-z0-9 &/-]{1,40})/i);
  const underMatch = message.match(/under\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i);
  const overMatch = message.match(/over\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i);
  const priorityMatch = message.match(/priority\s*([0-9]{1,3})/i);
  const fallbackMerchant = providerMatch?.[1] || quotedKeyword?.[1] || keywordMatch?.[1] || null;

  return {
    merchant: merchantMatch?.[1]?.trim() || fallbackMerchant,
    category: categoryMatch?.[1]?.trim() || null,
    amount_max: underMatch ? Number(underMatch[1]) : null,
    amount_min: overMatch ? Number(overMatch[1]) : null,
    direction: lower.includes("inflow") || lower.includes("income")
      ? "inflow"
      : lower.includes("outflow") || lower.includes("expense")
      ? "outflow"
      : null,
    priority: priorityMatch ? Number(priorityMatch[1]) : 50,
    transfer: lower.includes("transfer") ? true : null,
  };
}

export async function parseRuleWithProvider(
  message: string
): Promise<ParseRuleResult> {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase() as Provider;
  const openAiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let parsed: Record<string, unknown> | null = null;

  try {
    if (provider === "openai") {
      if (!openAiKey) {
        return {
          rule: null,
          response: "LLM provider is set to OpenAI but OPENAI_API_KEY is not configured.",
        };
      }
      parsed = await callOpenAI({ message, provider, apiKey: openAiKey });
    } else {
      if (!anthropicKey) {
        return {
          rule: null,
          response: "LLM provider is set to Anthropic but ANTHROPIC_API_KEY is not configured.",
        };
      }
      parsed = await callAnthropic({ message, provider, apiKey: anthropicKey });
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    parsed = regexFallback(message);
  }

  const merchant = typeof parsed.merchant === "string" ? parsed.merchant.trim() : null;
  const category = typeof parsed.category === "string" ? parsed.category.trim() : null;
  const direction = parsed.direction === "inflow" || parsed.direction === "outflow" ? parsed.direction : null;
  const amountMin = coerceNumber(parsed.amount_min);
  const amountMax = coerceNumber(parsed.amount_max);
  const priority = Math.max(0, Math.min(100, coerceNumber(parsed.priority) ?? 50));
  const clarification = typeof parsed.clarification === "string" ? parsed.clarification : undefined;

  if (!merchant || !category) {
    return {
      rule: null,
      clarification:
        clarification ||
        "I need both a merchant pattern and a destination category. Example: 'Categorize Starbucks under $15 as Coffee'.",
    };
  }

  return {
    rule: {
      name: `${merchant} → ${category}`,
      description: `Created from assistant prompt: ${message.slice(0, 140)}`,
      priority,
      is_active: true,
      match_merchant_contains: merchant,
      match_merchant_exact: null,
      match_amount_min: amountMin,
      match_amount_max: amountMax,
      match_direction: direction,
      assign_category_name: category,
      assign_category_id: null,
      assign_is_transfer: parsed.transfer === true ? true : null,
      assign_is_pass_through: null,
    },
  };
}
