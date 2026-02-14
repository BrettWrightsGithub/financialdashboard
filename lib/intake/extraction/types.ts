export type ReceiptExtractionMode = "ocr" | "google_model";

export interface ReceiptCategoryHint {
  id: string;
  name: string;
  usage_count: number;
}

export interface ReceiptLineItemExtraction {
  line_index: number;
  name: string | null;
  description: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  suggested_category_name: string | null;
  suggested_category_id: string | null;
  category_confidence: number | null;
  line_confidence: number | null;
}

export interface ReceiptExtractionNormalized {
  merchant_name: string | null;
  transaction_date: string | null;
  currency: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  extraction_confidence: number | null;
  raw_text: string | null;
  line_items: ReceiptLineItemExtraction[];
  warnings: string[];
}

export interface ReceiptProviderCallResult {
  provider: "openai" | "google";
  model: string;
  parsed: Record<string, unknown> | null;
  raw_response: unknown;
  raw_text: string | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  error?: string;
}
