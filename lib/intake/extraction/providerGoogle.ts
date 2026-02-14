import type { ReceiptCategoryHint, ReceiptProviderCallResult } from "@/lib/intake/extraction/types";
import { safeJsonParse } from "@/lib/intake/extraction/normalize";

const GOOGLE_SYSTEM_PROMPT = [
  "You are a strict receipt parser.",
  "Return valid JSON only. Do not return markdown or prose.",
  "The response must strictly follow the provided JSON schema.",
  "Output fields:",
  "merchant_name, transaction_date, currency, total_amount, tax_amount, shipping_amount, extraction_confidence, raw_text, warnings, line_items.",
  "Each line item must include:",
  "name, description, quantity, unit_price, line_total, suggested_category_name, category_confidence, confidence.",
  "Completeness rules:",
  "1) Include ALL visible purchased items in reading order.",
  "2) Never collapse multiple purchased rows into a single item.",
  "3) If an item wraps onto multiple lines, combine into one item description.",
  "4) Exclude summary rows: subtotal, tax, total, tip, discount, coupon, change.",
  "5) If quantity is missing, set quantity=1.",
  "6) If unit_price is missing, set unit_price=null and still include line_total when possible.",
  "7) If uncertain, keep the item with lower confidence instead of omitting it.",
  "8) If text is cut off/illegible, add a warning in warnings.",
  "Prefer suggested_category_name from provided category list.",
].join("\n");

const RECEIPT_LINE_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    name: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    quantity: { type: ["number", "null"] },
    unit_price: { type: ["number", "null"] },
    line_total: { type: ["number", "null"] },
    suggested_category_name: { type: ["string", "null"] },
    category_confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
    confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
  },
  required: ["name", "description", "quantity", "unit_price", "line_total", "suggested_category_name", "category_confidence", "confidence"],
  propertyOrdering: [
    "name",
    "description",
    "quantity",
    "unit_price",
    "line_total",
    "suggested_category_name",
    "category_confidence",
    "confidence",
  ],
} as const;

const RECEIPT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    merchant_name: { type: ["string", "null"] },
    transaction_date: { type: ["string", "null"], format: "date" },
    currency: { type: ["string", "null"] },
    total_amount: { type: ["number", "null"] },
    tax_amount: { type: ["number", "null"] },
    shipping_amount: { type: ["number", "null"] },
    extraction_confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
    raw_text: { type: ["string", "null"] },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    line_items: {
      type: "array",
      items: RECEIPT_LINE_ITEM_SCHEMA,
    },
  },
  required: [
    "merchant_name",
    "transaction_date",
    "currency",
    "total_amount",
    "tax_amount",
    "shipping_amount",
    "extraction_confidence",
    "raw_text",
    "warnings",
    "line_items",
  ],
  propertyOrdering: [
    "merchant_name",
    "transaction_date",
    "currency",
    "total_amount",
    "tax_amount",
    "shipping_amount",
    "extraction_confidence",
    "raw_text",
    "warnings",
    "line_items",
  ],
} as const;

function buildCategoryContext(categoryHints: ReceiptCategoryHint[]): string {
  if (!categoryHints.length) {
    return "No existing categories provided.";
  }

  return [
    "Existing categories (name : usage count):",
    ...categoryHints.map((hint) => `- ${hint.name}: ${hint.usage_count}`),
  ].join("\n");
}

function buildUserPrompt(categoryHints: ReceiptCategoryHint[]): string {
  return [
    GOOGLE_SYSTEM_PROMPT,
    "Keep numeric fields as numbers.",
    "line_items should represent purchasable rows, not receipt summary rows.",
    "If unsure, still provide best candidate and lower confidence.",
    buildCategoryContext(categoryHints),
  ].join("\n\n");
}

function extractTextParts(payload: unknown): string[] {
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> })?.candidates;
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates.flatMap((candidate) => {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) {
      return [];
    }
    return parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter((text) => text.length > 0);
  });
}

export async function callGoogleReceiptExtraction(params: {
  bytes: Uint8Array;
  mimeType: string;
  categoryHints: ReceiptCategoryHint[];
}): Promise<ReceiptProviderCallResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const model = process.env.GOOGLE_RECEIPT_MODEL || "gemini-2.5-pro";

  if (!apiKey) {
    return {
      provider: "google",
      model,
      parsed: null,
      raw_response: null,
      raw_text: null,
      error: "GOOGLE_API_KEY is not configured",
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildUserPrompt(params.categoryHints),
          },
          {
            inlineData: {
              mimeType: params.mimeType,
              data: Buffer.from(params.bytes).toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: RECEIPT_RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await response.json().catch(() => null);

    const promptTokens =
      typeof payload?.usageMetadata?.promptTokenCount === "number"
        ? payload.usageMetadata.promptTokenCount
        : undefined;
    const completionTokens =
      typeof payload?.usageMetadata?.candidatesTokenCount === "number"
        ? payload.usageMetadata.candidatesTokenCount
        : undefined;
    const totalTokens =
      typeof payload?.usageMetadata?.totalTokenCount === "number"
        ? payload.usageMetadata.totalTokenCount
        : undefined;

    if (!response.ok) {
      return {
        provider: "google",
        model,
        parsed: null,
        raw_response: payload,
        raw_text: null,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        error: `Google receipt request failed: ${response.status}`,
      };
    }

    const textParts = extractTextParts(payload);
    const combinedText = textParts.join("\n").trim();
    const longestPart = textParts.slice().sort((left, right) => right.length - left.length)[0] || "";
    const parseCandidates = [
      combinedText,
      longestPart,
      textParts[0] || "",
    ].filter((candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index);

    let parsed: Record<string, unknown> | null = null;
    for (const candidate of parseCandidates) {
      parsed = safeJsonParse(candidate);
      if (parsed) {
        break;
      }
    }

    if (!parsed) {
      return {
        provider: "google",
        model,
        parsed: null,
        raw_response: payload,
        raw_text: combinedText || longestPart || null,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        error: "Google receipt response did not contain valid JSON",
      };
    }

    return {
      provider: "google",
      model,
      parsed,
      raw_response: payload,
      raw_text: combinedText || longestPart || null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    };
  } catch (error) {
    return {
      provider: "google",
      model,
      parsed: null,
      raw_response: null,
      raw_text: null,
      error: error instanceof Error ? error.message : "Google receipt request failed",
    };
  }
}
