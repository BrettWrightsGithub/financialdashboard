import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  normalizeEditableLineItems,
  type EditableLineItemInput,
} from "@/lib/intake/extraction/service";

interface ExtractionRow {
  id: string;
  total_amount: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  merchant_name: string | null;
  transaction_date: string | null;
}

interface AccountRow {
  id: string;
  provider_account_id: string | null;
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

function normalizeTransactionDate(value: string | null): string {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const artifactId = typeof body?.artifact_id === "string" ? body.artifact_id.trim() : "";
    const allowTotalMismatch = body?.allow_total_mismatch === true;
    const lineItemsRaw = Array.isArray(body?.line_items) ? (body.line_items as EditableLineItemInput[]) : [];

    if (!artifactId) {
      return NextResponse.json({ error: "artifact_id is required" }, { status: 400 });
    }

    if (lineItemsRaw.length === 0) {
      return NextResponse.json({ error: "line_items must include at least one row" }, { status: 400 });
    }

    const normalizedLineItems = normalizeEditableLineItems(lineItemsRaw);
    const lineTotal = Number(
      normalizedLineItems.reduce((sum, lineItem) => sum + lineItem.line_total, 0).toFixed(2)
    );

    const supabase = createServerSupabaseClient();
    const { data: extraction, error: extractionError } = await supabase
      .from("intake_extractions")
      .select("id, total_amount, tax_amount, shipping_amount, merchant_name, transaction_date")
      .eq("artifact_id", artifactId)
      .maybeSingle();

    if (extractionError) {
      return NextResponse.json({ error: extractionError.message }, { status: 500 });
    }

    if (!extraction) {
      return NextResponse.json({ error: "No extraction exists for this artifact" }, { status: 404 });
    }

    const extractionRow = extraction as ExtractionRow;
    const expectedTotal = parseOptionalNumber(extractionRow.total_amount);
    const taxAmount = parseOptionalNumber(extractionRow.tax_amount) ?? 0;
    const shippingAmount = parseOptionalNumber(extractionRow.shipping_amount) ?? 0;
    const linePlusTaxShippingTotal = Number((lineTotal + taxAmount + shippingAmount).toFixed(2));
    const lineDifference =
      expectedTotal !== null ? Number((lineTotal - expectedTotal).toFixed(2)) : null;
    const adjustedDifference =
      expectedTotal !== null ? Number((linePlusTaxShippingTotal - expectedTotal).toFixed(2)) : null;
    const difference = (() => {
      if (expectedTotal === null) {
        return null;
      }
      if (lineDifference !== null && Math.abs(lineDifference) <= 1) {
        return lineDifference;
      }
      if (adjustedDifference !== null && Math.abs(adjustedDifference) <= 1) {
        return adjustedDifference;
      }
      if (lineDifference === null) {
        return adjustedDifference;
      }
      if (adjustedDifference === null) {
        return lineDifference;
      }
      return Math.abs(adjustedDifference) < Math.abs(lineDifference) ? adjustedDifference : lineDifference;
    })();

    if (difference !== null && Math.abs(difference) > 1 && !allowTotalMismatch) {
      const adjustmentSummary =
        adjustedDifference !== null && lineDifference !== null && adjustedDifference !== lineDifference
          ? ` With tax/shipping adjustment (${taxAmount >= 0 ? "+" : ""}${taxAmount.toFixed(2)}${shippingAmount !== 0 ? ` and ${shippingAmount >= 0 ? "+" : ""}${shippingAmount.toFixed(2)} shipping` : ""}), difference is ${adjustedDifference > 0 ? "+" : ""}${adjustedDifference.toFixed(2)}.`
          : "";
      return NextResponse.json(
        {
          error: `Line-item total mismatch ${lineDifference !== null ? `${lineDifference > 0 ? "+" : ""}${lineDifference.toFixed(2)}` : `${difference > 0 ? "+" : ""}${difference.toFixed(2)}`}.${adjustmentSummary} Enable override to save anyway.`,
          totals: {
            expected_total: expectedTotal,
            line_total: lineTotal,
            tax_amount: taxAmount,
            shipping_amount: shippingAmount,
            line_plus_tax_shipping_total: linePlusTaxShippingTotal,
            line_difference: lineDifference,
            adjusted_difference: adjustedDifference,
            difference,
          },
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: clearError } = await supabase
      .from("intake_line_items")
      .delete()
      .eq("extraction_id", extractionRow.id);
    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    const rowsToInsert = normalizedLineItems.map((lineItem, index) => ({
      extraction_id: extractionRow.id,
      line_index: index,
      description: lineItem.description,
      quantity: lineItem.quantity,
      unit_price: lineItem.unit_price,
      line_total: lineItem.line_total,
      suggested_category_id: lineItem.suggested_category_id,
      confirmed_category_id: lineItem.confirmed_category_id,
      raw_item_json: lineItem.raw_item_json,
      updated_at: now,
    }));

    const { error: insertError } = await supabase
      .from("intake_line_items")
      .insert(rowsToInsert);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: accountRows, error: accountError } = await supabase
      .from("accounts")
      .select("id, provider_account_id")
      .eq("is_active", true)
      .order("include_in_cashflow", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }

    const transactionAccount = Array.isArray(accountRows) && accountRows.length > 0
      ? (accountRows[0] as AccountRow)
      : null;

    if (!transactionAccount?.id) {
      return NextResponse.json(
        { error: "No active account found to apply receipt line items." },
        { status: 400 }
      );
    }

    const { error: clearTransactionsError } = await supabase
      .from("transactions")
      .delete()
      .eq("provider", "intake_upload")
      .like("provider_transaction_id", `intake:${artifactId}:%`);

    if (clearTransactionsError) {
      return NextResponse.json({ error: clearTransactionsError.message }, { status: 500 });
    }

    const transactionDate = normalizeTransactionDate(extractionRow.transaction_date);
    const merchantName = parseOptionalString(extractionRow.merchant_name);
    const transactionRows = rowsToInsert
      .filter((lineItem) => Math.abs(lineItem.line_total) > 0)
      .map((lineItem, index) => {
        const rawItem =
          lineItem.raw_item_json && typeof lineItem.raw_item_json === "object"
            ? (lineItem.raw_item_json as Record<string, unknown>)
            : {};
        const suggestedCategoryName = parseOptionalString(rawItem.suggested_category_name);
        const categoryConfidence = parseOptionalNumber(rawItem.category_confidence);
        const categoryAiConfidence =
          categoryConfidence === null
            ? null
            : Math.max(0, Math.min(100, Math.round((categoryConfidence <= 1 ? categoryConfidence * 100 : categoryConfidence))));

        return {
          provider: "intake_upload",
          provider_transaction_id: `intake:${artifactId}:${index}`,
          account_id: transactionAccount.id,
          provider_account_id: transactionAccount.provider_account_id || `intake:${transactionAccount.id}`,
          date: transactionDate,
          amount: Number((-Math.abs(lineItem.line_total)).toFixed(2)),
          description_raw: lineItem.description,
          description_clean: lineItem.description,
          life_category_id: lineItem.confirmed_category_id || lineItem.suggested_category_id || null,
          category_ai: suggestedCategoryName,
          category_ai_conf: categoryAiConfidence,
          category_locked: true,
          status: "posted",
          provider_type: "receipt_line_item",
          processing_status: "complete",
          counterparty_name: merchantName,
          is_transfer: false,
          is_pass_through: false,
          is_business: false,
          category_source: "manual",
        };
      });

    if (transactionRows.length > 0) {
      const { error: insertTransactionsError } = await supabase
        .from("transactions")
        .insert(transactionRows);

      if (insertTransactionsError) {
        return NextResponse.json({ error: insertTransactionsError.message }, { status: 500 });
      }
    }

    const { error: updateArtifactError } = await supabase
      .from("intake_artifacts")
      .update({
        status: "applied",
        error_message: null,
        updated_at: now,
      })
      .eq("id", artifactId);

    if (updateArtifactError) {
      return NextResponse.json({ error: updateArtifactError.message }, { status: 500 });
    }

    const { error: updateMatchError } = await supabase
      .from("intake_matches")
      .upsert(
        {
          extraction_id: extractionRow.id,
          status: "applied",
          match_reason: `Applied ${transactionRows.length} transaction line item(s) from receipt.`,
          updated_at: now,
        },
        { onConflict: "extraction_id" }
      );

    if (updateMatchError) {
      return NextResponse.json({ error: updateMatchError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      artifact_id: artifactId,
      status: "applied",
      transactions_created: transactionRows.length,
      totals: {
        expected_total: expectedTotal,
        line_total: lineTotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        line_plus_tax_shipping_total: linePlusTaxShippingTotal,
        line_difference: lineDifference,
        adjusted_difference: adjustedDifference,
        difference,
      },
      line_items: rowsToInsert,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save intake line items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
