import type { ReceiptCategoryHint, ReceiptProviderCallResult } from "@/lib/intake/extraction/types";
import { safeJsonParse } from "@/lib/intake/extraction/normalize";

const OCR_SYSTEM_PROMPT = [
  "You extract receipt data from images.",
  "Return strict JSON only.",
  "Capture merchant, transaction_date, currency, total_amount, tax_amount, shipping_amount, extraction_confidence, raw_text, line_items.",
  "Each line item should include: name, description, quantity, unit_price, line_total, suggested_category_name, category_confidence, confidence.",
  "Use category names from the provided list when possible.",
].join(" ");

function buildCategoryContext(categoryHints: ReceiptCategoryHint[]): string {
  if (!categoryHints.length) {
    return "No existing categories provided.";
  }

  return [
    "Existing categories (name : historical usage count):",
    ...categoryHints.map((hint) => `- ${hint.name}: ${hint.usage_count}`),
  ].join("\n");
}

function buildUserPrompt(categoryHints: ReceiptCategoryHint[]): string {
  return [
    "Extract this receipt image into structured JSON.",
    "Amounts should be numbers with decimal precision, not strings.",
    "If uncertain, include best estimate and lower confidence.",
    buildCategoryContext(categoryHints),
  ].join("\n\n");
}

export async function callOpenAiOcrExtraction(params: {
  bytes: Uint8Array;
  mimeType: string;
  categoryHints: ReceiptCategoryHint[];
}): Promise<ReceiptProviderCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_RECEIPT_OCR_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const endpoint = "https://api.openai.com/v1/chat/completions";

  if (!apiKey) {
    return {
      provider: "openai",
      model,
      parsed: null,
      raw_response: null,
      raw_text: null,
      error: "OPENAI_API_KEY is not configured",
    };
  }

  const dataUrl = `data:${params.mimeType};base64,${Buffer.from(params.bytes).toString("base64")}`;
  const supportsExplicitTemperature = !model.toLowerCase().startsWith("gpt-5");

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: OCR_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildUserPrompt(params.categoryHints),
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };

  if (supportsExplicitTemperature) {
    requestBody.temperature = 0;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

    if (!response.ok) {
      return {
        provider: "openai",
        model,
        parsed: null,
        raw_response: payload,
        raw_text: null,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        error: `OpenAI OCR request failed: ${response.status}`,
      };
    }

    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? safeJsonParse(content) : null;

    if (!parsed) {
      return {
        provider: "openai",
        model,
        parsed: null,
        raw_response: payload,
        raw_text: typeof content === "string" ? content : null,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        error: "OpenAI OCR response did not contain valid JSON",
      };
    }

    return {
      provider: "openai",
      model,
      parsed,
      raw_response: payload,
      raw_text: typeof content === "string" ? content : null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    };
  } catch (error) {
    return {
      provider: "openai",
      model,
      parsed: null,
      raw_response: null,
      raw_text: null,
      error: error instanceof Error ? error.message : "OpenAI OCR request failed",
    };
  }
}
