import { runIntakeRematch } from "@/lib/intake/rematch";
import { normalizeReceiptExtraction } from "@/lib/intake/extraction/normalize";
import { callGoogleReceiptExtraction } from "@/lib/intake/extraction/providerGoogle";
import { callOpenAiOcrExtraction } from "@/lib/intake/extraction/providerOcr";
import type {
  ReceiptCategoryHint,
  ReceiptExtractionMode,
  ReceiptProviderCallResult,
} from "@/lib/intake/extraction/types";

export type { ReceiptExtractionMode } from "@/lib/intake/extraction/types";

type SupabaseLike = {
  from: (table: string) => any;
};

const RECEIPT_EXTRACTION_MODES: ReceiptExtractionMode[] = ["ocr", "google_model"];
const RECEIPT_LOG_PREFIX = "[intake.receipt]";

function normalizeCategoryName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferMimeFromFilename(filename: string): string | null {
  const lowered = filename.toLowerCase();
  if (lowered.endsWith(".heic")) return "image/heic";
  if (lowered.endsWith(".heif")) return "image/heif";
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) return "image/jpeg";
  if (lowered.endsWith(".png")) return "image/png";
  if (lowered.endsWith(".webp")) return "image/webp";
  if (lowered.endsWith(".pdf")) return "application/pdf";
  return null;
}

export function parseReceiptExtractionMode(value: FormDataEntryValue | null): ReceiptExtractionMode | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return RECEIPT_EXTRACTION_MODES.includes(normalized as ReceiptExtractionMode)
    ? (normalized as ReceiptExtractionMode)
    : null;
}

export function resolveReceiptMimeType(filename: string, mimeType: string): string {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime && normalizedMime !== "application/octet-stream") {
    return normalizedMime;
  }
  return inferMimeFromFilename(filename) || "application/octet-stream";
}

function supportsImageExtraction(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

async function fetchCategoryHints(supabase: SupabaseLike): Promise<ReceiptCategoryHint[]> {
  const [{ data: categoriesRaw, error: categoriesError }, { data: usageRowsRaw }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .limit(500),
    supabase
      .from("transactions")
      .select("life_category_id")
      .not("life_category_id", "is", null)
      .limit(5000),
  ]);

  if (categoriesError || !Array.isArray(categoriesRaw)) {
    return [];
  }

  const usageByCategoryId = new Map<string, number>();
  for (const row of (usageRowsRaw || []) as Array<{ life_category_id?: string | null }>) {
    const categoryId = typeof row.life_category_id === "string" ? row.life_category_id : null;
    if (!categoryId) {
      continue;
    }
    usageByCategoryId.set(categoryId, (usageByCategoryId.get(categoryId) || 0) + 1);
  }

  return (categoriesRaw as Array<{ id: string; name: string }>)
    .map((category) => ({
      id: category.id,
      name: category.name,
      usage_count: usageByCategoryId.get(category.id) || 0,
    }))
    .sort((left, right) => {
      if (right.usage_count !== left.usage_count) {
        return right.usage_count - left.usage_count;
      }
      return left.name.localeCompare(right.name);
    });
}

async function callProvider(params: {
  mode: ReceiptExtractionMode;
  bytes: Uint8Array;
  mimeType: string;
  categoryHints: ReceiptCategoryHint[];
}): Promise<ReceiptProviderCallResult> {
  if (params.mode === "google_model") {
    return callGoogleReceiptExtraction({
      bytes: params.bytes,
      mimeType: params.mimeType,
      categoryHints: params.categoryHints.slice(0, 80),
    });
  }
  return callOpenAiOcrExtraction({
    bytes: params.bytes,
    mimeType: params.mimeType,
    categoryHints: params.categoryHints.slice(0, 80),
  });
}

function toCategorySummary(hints: ReceiptCategoryHint[]): Array<{ name: string; usage_count: number }> {
  return hints.slice(0, 50).map((hint) => ({ name: hint.name, usage_count: hint.usage_count }));
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

function readProviderLineItemsCount(parsed: Record<string, unknown> | null): number {
  if (!parsed) {
    return 0;
  }
  if (Array.isArray(parsed.line_items)) {
    return parsed.line_items.length;
  }
  if (Array.isArray(parsed.items)) {
    return parsed.items.length;
  }
  return 0;
}

function toLogError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function truncateForLog(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`;
}

function stringifyForLog(value: unknown, maxLength: number): string | null {
  try {
    const text = JSON.stringify(value);
    if (!text) {
      return null;
    }
    return truncateForLog(text, maxLength);
  } catch {
    return null;
  }
}

function buildProviderDebugPreview(providerResult: ReceiptProviderCallResult): string | null {
  if (providerResult.raw_text && providerResult.raw_text.trim().length > 0) {
    return truncateForLog(providerResult.raw_text, 2200);
  }
  const jsonPreview = stringifyForLog(providerResult.raw_response, 2200);
  if (jsonPreview) {
    return jsonPreview;
  }
  return null;
}

async function persistArtifactDebugPayload(params: {
  supabase: SupabaseLike;
  artifactId: string;
  providerResult: ReceiptProviderCallResult;
  reason: string;
  mode: ReceiptExtractionMode;
}): Promise<void> {
  try {
    const { data: artifact, error: fetchError } = await params.supabase
      .from("intake_artifacts")
      .select("raw_payload_json")
      .eq("id", params.artifactId)
      .maybeSingle();

    if (fetchError) {
      return;
    }

    const existingRawPayload =
      artifact && typeof artifact === "object" && artifact.raw_payload_json && typeof artifact.raw_payload_json === "object"
        ? (artifact.raw_payload_json as Record<string, unknown>)
        : {};

    const debugPayload = {
      ...existingRawPayload,
      receipt_debug: {
        ...(existingRawPayload.receipt_debug && typeof existingRawPayload.receipt_debug === "object"
          ? (existingRawPayload.receipt_debug as Record<string, unknown>)
          : {}),
        reason: params.reason,
        mode: params.mode,
        provider: params.providerResult.provider,
        model: params.providerResult.model,
        provider_error: params.providerResult.error || null,
        raw_text: params.providerResult.raw_text || null,
        raw_response: params.providerResult.raw_response ?? null,
        raw_text_preview: buildProviderDebugPreview(params.providerResult),
        raw_response_preview: stringifyForLog(params.providerResult.raw_response, 3500),
        prompt_tokens: params.providerResult.prompt_tokens ?? null,
        completion_tokens: params.providerResult.completion_tokens ?? null,
        total_tokens: params.providerResult.total_tokens ?? null,
        captured_at: new Date().toISOString(),
      },
    };

    await params.supabase
      .from("intake_artifacts")
      .update({
        raw_payload_json: debugPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.artifactId);
  } catch {
    // Best-effort debug persistence only.
  }
}

export interface ExtractAndPersistReceiptParams {
  supabase: SupabaseLike;
  artifactId: string;
  filename: string;
  mimeType: string;
  mode: ReceiptExtractionMode;
  fileBytes: Uint8Array;
}

export async function extractAndPersistUploadReceipt(
  params: ExtractAndPersistReceiptParams
): Promise<{
  status: "parsed" | "needs_review";
  error_message: string | null;
  ai_response_preview: string | null;
  provider: "openai" | "google" | null;
  model: string | null;
}> {
  const now = new Date().toISOString();
  const effectiveMimeType = resolveReceiptMimeType(params.filename, params.mimeType);
  console.info(`${RECEIPT_LOG_PREFIX} extraction_start`, {
    artifact_id: params.artifactId,
    filename: params.filename,
    mime_type: params.mimeType,
    effective_mime_type: effectiveMimeType,
    mode: params.mode,
    size_bytes: params.fileBytes.byteLength,
  });

  if (!supportsImageExtraction(effectiveMimeType)) {
    const message = "Extraction currently supports image receipts. You can still edit line items manually.";
    console.warn(`${RECEIPT_LOG_PREFIX} unsupported_media`, {
      artifact_id: params.artifactId,
      effective_mime_type: effectiveMimeType,
      message,
    });
    await params.supabase
      .from("intake_artifacts")
      .update({
        status: "needs_review",
        error_message: message,
        processed_at: now,
        updated_at: now,
      })
      .eq("id", params.artifactId);

    return {
      status: "needs_review",
      error_message: message,
      ai_response_preview: null,
      provider: null,
      model: null,
    };
  }

  try {
    const categoryHints = await fetchCategoryHints(params.supabase);
    console.info(`${RECEIPT_LOG_PREFIX} category_context_loaded`, {
      artifact_id: params.artifactId,
      category_hint_count: categoryHints.length,
      top_categories: categoryHints.slice(0, 8).map((category) => ({
        name: category.name,
        usage_count: category.usage_count,
      })),
    });
    const providerResult = await callProvider({
      mode: params.mode,
      bytes: params.fileBytes,
      mimeType: effectiveMimeType,
      categoryHints,
    });
    console.info(`${RECEIPT_LOG_PREFIX} provider_response`, {
      artifact_id: params.artifactId,
      mode: params.mode,
      provider: providerResult.provider,
      model: providerResult.model,
      has_parsed_json: Boolean(providerResult.parsed),
      parsed_keys: providerResult.parsed ? Object.keys(providerResult.parsed).slice(0, 20) : [],
      provider_line_items_count: readProviderLineItemsCount(providerResult.parsed),
      prompt_tokens: providerResult.prompt_tokens ?? null,
      completion_tokens: providerResult.completion_tokens ?? null,
      total_tokens: providerResult.total_tokens ?? null,
      provider_error: providerResult.error || null,
      provider_text_preview: providerResult.raw_text
        ? truncateForLog(providerResult.raw_text, 700)
        : null,
    });
    await persistArtifactDebugPayload({
      supabase: params.supabase,
      artifactId: params.artifactId,
      providerResult,
      reason: "provider_response",
      mode: params.mode,
    });

    if (!providerResult.parsed || providerResult.error) {
      const baseMessage = providerResult.error || "Receipt extraction did not return valid JSON";
      const preview = buildProviderDebugPreview(providerResult);
      const message =
        preview && preview.length > 0
          ? `${baseMessage}. Model output preview: ${truncateForLog(preview, 280)}`
          : baseMessage;
      console.warn(`${RECEIPT_LOG_PREFIX} provider_parse_failure`, {
        artifact_id: params.artifactId,
        message: baseMessage,
        output_preview: preview,
        raw_response_preview: stringifyForLog(providerResult.raw_response, 3500),
      });
      await persistArtifactDebugPayload({
        supabase: params.supabase,
        artifactId: params.artifactId,
        providerResult,
        reason: "provider_parse_failure",
        mode: params.mode,
      });
      await params.supabase
        .from("intake_artifacts")
        .update({
          status: "needs_review",
          error_message: message,
          processed_at: now,
          updated_at: now,
        })
        .eq("id", params.artifactId);

      return {
        status: "needs_review",
        error_message: message,
        ai_response_preview: preview,
        provider: providerResult.provider,
        model: providerResult.model,
      };
    }

    const normalized = normalizeReceiptExtraction(providerResult.parsed, categoryHints);
    console.info(`${RECEIPT_LOG_PREFIX} normalized_extraction`, {
      artifact_id: params.artifactId,
      merchant_name: normalized.merchant_name,
      transaction_date: normalized.transaction_date,
      currency: normalized.currency,
      total_amount: normalized.total_amount,
      extraction_confidence: normalized.extraction_confidence,
      normalized_line_items_count: normalized.line_items.length,
      line_item_preview: normalized.line_items.slice(0, 8).map((item) => ({
        line_index: item.line_index,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        suggested_category_name: item.suggested_category_name,
        category_confidence: item.category_confidence,
        line_confidence: item.line_confidence,
      })),
      warnings: normalized.warnings,
    });
    const extractionRawJson = {
      provider: providerResult.provider,
      model: providerResult.model,
      mode: params.mode,
      warnings: normalized.warnings,
      category_hints: toCategorySummary(categoryHints),
      raw_text: normalized.raw_text,
      raw_response: providerResult.raw_response,
    };

    const { data: extractionUpsert, error: extractionError } = await params.supabase
      .from("intake_extractions")
      .upsert(
        {
          artifact_id: params.artifactId,
          merchant_name: normalized.merchant_name,
          transaction_date: normalized.transaction_date,
          currency: normalized.currency,
          total_amount: normalized.total_amount,
          tax_amount: normalized.tax_amount,
          shipping_amount: normalized.shipping_amount,
          extraction_confidence: normalized.extraction_confidence,
          raw_extraction_json: extractionRawJson,
          updated_at: now,
        },
        { onConflict: "artifact_id" }
      )
      .select("id, total_amount")
      .single();

    if (extractionError || !extractionUpsert?.id) {
      console.error(`${RECEIPT_LOG_PREFIX} extraction_persist_failure`, {
        artifact_id: params.artifactId,
        error: extractionError?.message || "missing extraction id",
      });
      throw new Error(`Failed to save extraction: ${extractionError?.message || "missing extraction id"}`);
    }

    const extractionId = extractionUpsert.id as string;
    const extractionTotal = parseOptionalNumber(extractionUpsert.total_amount);

    const lineItems = normalized.line_items.map((item, index) => ({
      extraction_id: extractionId,
      line_index: index,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      suggested_category_id: item.suggested_category_id,
      confirmed_category_id: null,
      raw_item_json: {
        name: item.name,
        suggested_category_name: item.suggested_category_name,
        category_confidence: item.category_confidence,
        line_confidence: item.line_confidence,
        source: "receipt_upload",
        mode: params.mode,
        provider: providerResult.provider,
      },
      updated_at: now,
    }));

    await params.supabase.from("intake_line_items").delete().eq("extraction_id", extractionId);
    if (lineItems.length > 0) {
      const { error: lineItemsError } = await params.supabase
        .from("intake_line_items")
        .insert(lineItems);
      if (lineItemsError) {
        console.error(`${RECEIPT_LOG_PREFIX} line_items_persist_failure`, {
          artifact_id: params.artifactId,
          extraction_id: extractionId,
          line_items_count: lineItems.length,
          error: lineItemsError.message,
        });
        throw new Error(`Failed to save line items: ${lineItemsError.message}`);
      }
    }

    const computedTotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const totalMismatch =
      extractionTotal !== null ? Number((computedTotal - extractionTotal).toFixed(2)) : null;
    console.info(`${RECEIPT_LOG_PREFIX} totals_evaluated`, {
      artifact_id: params.artifactId,
      extraction_id: extractionId,
      extraction_total: extractionTotal,
      computed_line_total: Number(computedTotal.toFixed(2)),
      total_mismatch: totalMismatch,
    });

    await params.supabase.from("intake_matches").upsert(
      {
        extraction_id: extractionId,
        status: "unmatched",
        updated_at: now,
      },
      { onConflict: "extraction_id", ignoreDuplicates: true }
    );

    await params.supabase
      .from("intake_artifacts")
      .update({
        status: "parsed",
        processed_at: now,
        error_message: totalMismatch !== null && Math.abs(totalMismatch) > 1
          ? `Line-item total mismatch ${totalMismatch > 0 ? "+" : ""}${totalMismatch.toFixed(2)}`
          : null,
        updated_at: now,
      })
      .eq("id", params.artifactId);

    // Reuse shared matching engine so upload receipts can be candidate-linked.
    const rematchSummary = await runIntakeRematch(params.supabase as any, {
      sourceType: "upload",
      limit: 200,
    }).catch((error) => {
      console.warn(`${RECEIPT_LOG_PREFIX} rematch_failure`, {
        artifact_id: params.artifactId,
        error: toLogError(error),
      });
      return undefined;
    });
    if (rematchSummary) {
      console.info(`${RECEIPT_LOG_PREFIX} rematch_success`, {
        artifact_id: params.artifactId,
        run_id: rematchSummary.run_id,
        processed_count: rematchSummary.processed_count,
        matched_count: rematchSummary.matched_count,
        suggested_count: rematchSummary.suggested_count,
        unmatched_count: rematchSummary.unmatched_count,
      });
    }

    console.info(`${RECEIPT_LOG_PREFIX} extraction_complete`, {
      artifact_id: params.artifactId,
      status: "parsed",
      line_items_count: lineItems.length,
      total_mismatch: totalMismatch,
    });

    return {
      status: "parsed",
      error_message: totalMismatch !== null && Math.abs(totalMismatch) > 1
        ? `Line-item total mismatch ${totalMismatch > 0 ? "+" : ""}${totalMismatch.toFixed(2)}`
        : null,
      ai_response_preview: buildProviderDebugPreview(providerResult),
      provider: providerResult.provider,
      model: providerResult.model,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receipt extraction failed";
    console.error(`${RECEIPT_LOG_PREFIX} extraction_exception`, {
      artifact_id: params.artifactId,
      message,
    });
    await params.supabase
      .from("intake_artifacts")
      .update({
        status: "needs_review",
        error_message: message,
        processed_at: now,
        updated_at: now,
      })
      .eq("id", params.artifactId);

    return {
      status: "needs_review",
      error_message: message,
      ai_response_preview: null,
      provider: null,
      model: null,
    };
  }
}

export interface EditableLineItemInput {
  id?: string;
  line_index?: number;
  name?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  line_total?: number | string | null;
  suggested_category_id?: string | null;
  confirmed_category_id?: string | null;
  category_confidence?: number | string | null;
}

export function normalizeEditableLineItems(
  lineItems: EditableLineItemInput[]
): Array<{
  line_index: number;
  description: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  suggested_category_id: string | null;
  confirmed_category_id: string | null;
  raw_item_json: Record<string, unknown>;
}> {
  return lineItems.map((item, index) => {
    const quantityRaw = parseOptionalNumber(item.quantity);
    const quantity = quantityRaw && quantityRaw > 0 ? Number(quantityRaw.toFixed(3)) : 1;
    const unitPriceRaw = parseOptionalNumber(item.unit_price);
    const explicitLineTotal = parseOptionalNumber(item.line_total);
    const computedLineTotal = explicitLineTotal !== null
      ? explicitLineTotal
      : unitPriceRaw !== null
        ? quantity * unitPriceRaw
        : 0;

    const name = typeof item.name === "string" ? item.name.trim() : "";
    const descriptionInput = typeof item.description === "string" ? item.description.trim() : "";
    const description = descriptionInput || name || `Item ${index + 1}`;

    return {
      line_index: Number.isInteger(item.line_index) ? Number(item.line_index) : index,
      description,
      quantity,
      unit_price: unitPriceRaw !== null ? Number(unitPriceRaw.toFixed(2)) : null,
      line_total: Number(computedLineTotal.toFixed(2)),
      suggested_category_id:
        typeof item.suggested_category_id === "string" && item.suggested_category_id.length > 0
          ? item.suggested_category_id
          : null,
      confirmed_category_id:
        typeof item.confirmed_category_id === "string" && item.confirmed_category_id.length > 0
          ? item.confirmed_category_id
          : null,
      raw_item_json: {
        name: name || null,
        category_confidence: (() => {
          const confidence = parseOptionalNumber(item.category_confidence);
          if (confidence === null) return null;
          if (confidence < 0) return 0;
          if (confidence > 1) return 1;
          return Number(confidence.toFixed(3));
        })(),
        source: "user_edit",
      },
    };
  }).sort((left, right) => left.line_index - right.line_index);
}

export function categoryNameLookup(hints: ReceiptCategoryHint[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const hint of hints) {
    const key = normalizeCategoryName(hint.name);
    if (key.length > 0 && !lookup.has(key)) {
      lookup.set(key, hint.id);
    }
  }
  return lookup;
}
