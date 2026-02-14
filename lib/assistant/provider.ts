import type { AssistantLlmCallDebug, ParseRuleResult } from "./types";

type Provider = "openai" | "anthropic";

interface ProviderInput {
  message: string;
  provider: Provider;
  apiKey: string;
}

interface ProviderCallResult {
  parsed: Record<string, unknown> | null;
  debug: AssistantLlmCallDebug;
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

async function callOpenAI(input: ProviderInput): Promise<ProviderCallResult> {
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const supportsExplicitTemperature = !model.toLowerCase().startsWith("gpt-5");
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input.message },
    ],
    response_format: { type: "json_object" },
  };
  if (supportsExplicitTemperature) {
    requestBody.temperature = 0;
  }

  const debugBase: AssistantLlmCallDebug = {
    provider: "openai",
    endpoint,
    model,
    request: {
      system_prompt: SYSTEM_PROMPT,
      user_message: input.message,
      response_format: "json_object",
      temperature: supportsExplicitTemperature ? 0 : "default",
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await response.json().catch(() => null);
    const promptTokens =
      typeof payload?.usage?.prompt_tokens === "number" ? payload.usage.prompt_tokens : undefined;
    const completionTokens =
      typeof payload?.usage?.completion_tokens === "number"
        ? payload.usage.completion_tokens
        : undefined;
    const totalTokens =
      typeof payload?.usage?.total_tokens === "number" ? payload.usage.total_tokens : undefined;
    const responseDebug = {
      ...debugBase,
      status: response.status,
      response: payload,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    };

    if (!response.ok) {
      return {
        parsed: null,
        debug: {
          ...responseDebug,
          error: `OpenAI request failed: ${response.status}`,
        },
      };
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return {
        parsed: null,
        debug: {
          ...responseDebug,
          error: "OpenAI response did not include content.",
        },
      };
    }

    return {
      parsed: safeJsonParse(content),
      debug: responseDebug,
    };
  } catch (error) {
    return {
      parsed: null,
      debug: {
        ...debugBase,
        error: error instanceof Error ? error.message : "OpenAI request failed",
      },
    };
  }
}

async function callAnthropic(input: ProviderInput): Promise<ProviderCallResult> {
  const endpoint = "https://api.anthropic.com/v1/messages";
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  const requestBody = {
    model,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: input.message }],
  };

  const debugBase: AssistantLlmCallDebug = {
    provider: "anthropic",
    endpoint,
    model,
    request: {
      system_prompt: SYSTEM_PROMPT,
      user_message: input.message,
      max_tokens: 300,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await response.json().catch(() => null);
    const promptTokens =
      typeof payload?.usage?.input_tokens === "number" ? payload.usage.input_tokens : undefined;
    const completionTokens =
      typeof payload?.usage?.output_tokens === "number" ? payload.usage.output_tokens : undefined;
    const totalTokens =
      typeof promptTokens === "number" && typeof completionTokens === "number"
        ? promptTokens + completionTokens
        : undefined;
    const responseDebug = {
      ...debugBase,
      status: response.status,
      response: payload,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    };

    if (!response.ok) {
      return {
        parsed: null,
        debug: {
          ...responseDebug,
          error: `Anthropic request failed: ${response.status}`,
        },
      };
    }

    const content = payload?.content?.[0]?.text;
    if (!content || typeof content !== "string") {
      return {
        parsed: null,
        debug: {
          ...responseDebug,
          error: "Anthropic response did not include content.",
        },
      };
    }

    return {
      parsed: safeJsonParse(content),
      debug: responseDebug,
    };
  } catch (error) {
    return {
      parsed: null,
      debug: {
        ...debugBase,
        error: error instanceof Error ? error.message : "Anthropic request failed",
      },
    };
  }
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
  let llmCallDebug: AssistantLlmCallDebug | undefined;
  let fallbackReason: string | undefined;

  if (provider === "openai") {
    if (!openAiKey) {
      llmCallDebug = {
        provider: "openai",
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        request: {
          system_prompt: SYSTEM_PROMPT,
          user_message: message,
        },
        error: "OPENAI_API_KEY is not configured",
      };
      fallbackReason = "OPENAI_API_KEY is not configured";
    }
    if (openAiKey) {
      const llmResult = await callOpenAI({ message, provider, apiKey: openAiKey });
      parsed = llmResult.parsed;
      llmCallDebug = llmResult.debug;
    }
  } else {
    if (!anthropicKey) {
      llmCallDebug = {
        provider: "anthropic",
        endpoint: "https://api.anthropic.com/v1/messages",
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
        request: {
          system_prompt: SYSTEM_PROMPT,
          user_message: message,
        },
        error: "ANTHROPIC_API_KEY is not configured",
      };
      fallbackReason = "ANTHROPIC_API_KEY is not configured";
    }
    if (anthropicKey) {
      const llmResult = await callAnthropic({ message, provider, apiKey: anthropicKey });
      parsed = llmResult.parsed;
      llmCallDebug = llmResult.debug;
    }
  }

  const usedRegexFallback = !parsed;
  if (!parsed) {
    parsed = regexFallback(message);
    fallbackReason = llmCallDebug?.error || "Model returned empty or unparsable JSON.";
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
      debug: {
        llm_call: llmCallDebug,
        used_regex_fallback: usedRegexFallback,
        fallback_reason: fallbackReason,
        parsed_payload: parsed,
      },
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
    debug: {
      llm_call: llmCallDebug,
      used_regex_fallback: usedRegexFallback,
      fallback_reason: fallbackReason,
      parsed_payload: parsed,
    },
  };
}
