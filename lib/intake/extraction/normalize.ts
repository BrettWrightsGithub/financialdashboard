import type {
  ReceiptCategoryHint,
  ReceiptExtractionNormalized,
  ReceiptLineItemExtraction,
} from "@/lib/intake/extraction/types";

function normalizeCategoryName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampConfidence(value: unknown): number | null {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    return null;
  }
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return Number(parsed.toFixed(3));
}

function normalizeDate(value: unknown): string | null {
  const raw = parseOptionalString(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function readLineItems(raw: Record<string, unknown>): unknown[] {
  if (Array.isArray(raw.line_items)) {
    return raw.line_items;
  }
  if (Array.isArray(raw.items)) {
    return raw.items;
  }
  return [];
}

function buildCategoryLookup(hints: ReceiptCategoryHint[]): Map<string, string> {
  const byName = new Map<string, string>();
  for (const hint of hints) {
    const key = normalizeCategoryName(hint.name);
    if (key.length > 0 && !byName.has(key)) {
      byName.set(key, hint.id);
    }
  }
  return byName;
}

function normalizeLineItems(
  raw: Record<string, unknown>,
  categoryHints: ReceiptCategoryHint[]
): ReceiptLineItemExtraction[] {
  const categoryLookup = buildCategoryLookup(categoryHints);
  const items = readLineItems(raw);
  const normalized: ReceiptLineItemExtraction[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const payload = item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    const parsedQuantity = parseOptionalNumber(payload.quantity);
    const quantity = parsedQuantity && parsedQuantity > 0 ? Number(parsedQuantity.toFixed(3)) : 1;

    const unitPrice = parseOptionalNumber(payload.unit_price);
    const parsedLineTotal = parseOptionalNumber(payload.line_total ?? payload.amount);
    const lineTotal =
      parsedLineTotal !== null
        ? Number(parsedLineTotal.toFixed(2))
        : unitPrice !== null
          ? Number((quantity * unitPrice).toFixed(2))
          : 0;

    const name = parseOptionalString(payload.name ?? payload.title ?? payload.item_name);
    const description = parseOptionalString(payload.description ?? payload.desc ?? payload.label) || name || `Item ${index + 1}`;

    const suggestedCategoryName = parseOptionalString(
      payload.suggested_category_name ?? payload.category_name ?? payload.category
    );
    const suggestedCategoryKey = suggestedCategoryName ? normalizeCategoryName(suggestedCategoryName) : "";

    normalized.push({
      line_index: index,
      name,
      description,
      quantity,
      unit_price: unitPrice !== null ? Number(unitPrice.toFixed(2)) : null,
      line_total: Number(lineTotal.toFixed(2)),
      suggested_category_name: suggestedCategoryName,
      suggested_category_id: suggestedCategoryKey ? categoryLookup.get(suggestedCategoryKey) || null : null,
      category_confidence: clampConfidence(payload.category_confidence),
      line_confidence: clampConfidence(payload.confidence ?? payload.line_confidence),
    });
  }

  return normalized;
}

export function normalizeReceiptExtraction(
  raw: Record<string, unknown>,
  categoryHints: ReceiptCategoryHint[]
): ReceiptExtractionNormalized {
  const totalAmount = parseOptionalNumber(raw.total_amount ?? raw.total);
  const lineItems = normalizeLineItems(raw, categoryHints);
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [];

  // Keep at least one editable line if extraction only returned totals.
  if (lineItems.length === 0 && totalAmount !== null) {
    lineItems.push({
      line_index: 0,
      name: null,
      description: "Receipt total",
      quantity: 1,
      unit_price: Number(totalAmount.toFixed(2)),
      line_total: Number(totalAmount.toFixed(2)),
      suggested_category_name: null,
      suggested_category_id: null,
      category_confidence: null,
      line_confidence: null,
    });
    warnings.push("Extractor returned zero line items; inserted synthetic total line.");
  } else if (lineItems.length === 0) {
    warnings.push("Extractor returned zero line items and no total amount.");
  }

  return {
    merchant_name: parseOptionalString(raw.merchant_name ?? raw.merchant),
    transaction_date: normalizeDate(raw.transaction_date ?? raw.date),
    currency: (parseOptionalString(raw.currency) || "USD").toUpperCase(),
    total_amount: totalAmount !== null ? Number(totalAmount.toFixed(2)) : null,
    tax_amount: (() => {
      const tax = parseOptionalNumber(raw.tax_amount ?? raw.tax);
      return tax !== null ? Number(tax.toFixed(2)) : null;
    })(),
    shipping_amount: (() => {
      const shipping = parseOptionalNumber(raw.shipping_amount ?? raw.shipping);
      return shipping !== null ? Number(shipping.toFixed(2)) : null;
    })(),
    extraction_confidence: clampConfidence(raw.extraction_confidence ?? raw.confidence),
    raw_text: parseOptionalString(raw.raw_text ?? raw.ocr_text),
    line_items: lineItems,
    warnings,
  };
}

export function safeJsonParse(text: string): Record<string, unknown> | null {
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
