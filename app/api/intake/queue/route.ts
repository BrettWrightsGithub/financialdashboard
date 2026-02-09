import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

const ALLOWED_SOURCES = new Set(["upload", "csv", "amazon_extension"]);
const ALLOWED_STATUSES = new Set([
  "received",
  "parsed",
  "matched",
  "needs_review",
  "ready_to_apply",
  "applied",
  "error",
]);

interface IntakeArtifactRow {
  id: string;
  source_type: string;
  marketplace: string | null;
  provider_order_id: string | null;
  status: string;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
}

interface IntakeExtractionRow {
  id: string;
  artifact_id: string;
  merchant_name: string | null;
  transaction_date: string | null;
  currency: string | null;
  total_amount: number | null;
}

interface IntakeMatchRow {
  id: string;
  extraction_id: string;
  transaction_id: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  status: string;
  updated_at: string;
}

interface IntakeLineItemRow {
  id: string;
  extraction_id: string;
  line_index: number;
  description: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
}

interface ExternalOrderRow {
  id: string;
  intake_artifact_id: string;
  marketplace: string;
  provider_order_id: string;
  order_date: string;
  order_total: number;
  currency: string;
}

interface ExternalOrderItemRow {
  id: string;
  external_order_id: string;
  line_index: number;
  item_title: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
}

interface CsvImportBatchRow {
  id: string;
  artifact_id: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  applied_rows: number;
  created_at: string;
  updated_at: string;
}

interface IntakeRematchRunRow {
  id: string;
  source_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  matched_count: number;
  suggested_count: number;
  unmatched_count: number;
  skipped_count: number;
  reconciled_manual_count: number;
  processed_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

type LinkStatus = "awaiting_card_sync" | "matched_candidate" | "needs_review" | "applied";

function isMissingRelationError(error: { message?: string } | null): boolean {
  if (!error?.message) {
    return false;
  }

  return (
    error.message.includes("Could not find the table") ||
    error.message.includes("does not exist") ||
    error.message.includes("schema cache")
  );
}

function deriveLinkStatus(artifactStatus: string, match: IntakeMatchRow | null): LinkStatus {
  if (artifactStatus === "applied" || match?.status === "applied") {
    return "applied";
  }

  if (match?.status === "suggested" && match.transaction_id) {
    if ((match.match_confidence ?? 0) >= 0.9) {
      return "matched_candidate";
    }
    return "needs_review";
  }

  if (match?.status === "confirmed" && match.transaction_id) {
    return "matched_candidate";
  }

  if (match?.match_reason?.toLowerCase().includes("sync your card account first")) {
    return "awaiting_card_sync";
  }

  return "needs_review";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const status = searchParams.get("status");

    if (source && !ALLOWED_SOURCES.has(source)) {
      return NextResponse.json({ error: "Invalid source filter" }, { status: 400 });
    }

    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = createServerSupabaseClient();
    let artifactsQuery = supabase
      .from("intake_artifacts")
      .select(
        "id, source_type, marketplace, provider_order_id, status, error_message, received_at, processed_at",
        { count: "exact" }
      )
      .order("received_at", { ascending: false })
      .range(from, to);

    if (source) {
      artifactsQuery = artifactsQuery.eq("source_type", source);
    }

    if (status) {
      artifactsQuery = artifactsQuery.eq("status", status);
    }

    const { data: artifacts, count, error: artifactError } = await artifactsQuery;
    if (artifactError) {
      return NextResponse.json({ error: artifactError.message }, { status: 500 });
    }

    const artifactRows = (artifacts || []) as IntakeArtifactRow[];
    const artifactIds = artifactRows.map((artifact) => artifact.id);

    let extractionRows: IntakeExtractionRow[] = [];
    let matchRows: IntakeMatchRow[] = [];
    let lineItemRows: IntakeLineItemRow[] = [];
    let externalOrderRows: ExternalOrderRow[] = [];
    let externalOrderItemRows: ExternalOrderItemRow[] = [];
    let csvBatchRows: CsvImportBatchRow[] = [];
    let latestRematchRun: IntakeRematchRunRow | null = null;

    if (artifactIds.length > 0) {
      const { data: extractions, error: extractionError } = await supabase
        .from("intake_extractions")
        .select("id, artifact_id, merchant_name, transaction_date, currency, total_amount")
        .in("artifact_id", artifactIds);

      if (extractionError) {
        return NextResponse.json({ error: extractionError.message }, { status: 500 });
      }
      extractionRows = (extractions || []) as IntakeExtractionRow[];

      const extractionIds = extractionRows.map((row) => row.id);
      if (extractionIds.length > 0) {
        const { data: matches, error: matchesError } = await supabase
          .from("intake_matches")
          .select("id, extraction_id, transaction_id, match_confidence, match_reason, status, updated_at")
          .in("extraction_id", extractionIds);

        if (matchesError) {
          return NextResponse.json({ error: matchesError.message }, { status: 500 });
        }

        matchRows = (matches || []) as IntakeMatchRow[];

        const { data: lineItems, error: lineItemError } = await supabase
          .from("intake_line_items")
          .select("id, extraction_id, line_index, description, quantity, unit_price, line_total")
          .in("extraction_id", extractionIds)
          .order("line_index", { ascending: true });

        if (lineItemError) {
          return NextResponse.json({ error: lineItemError.message }, { status: 500 });
        }

        lineItemRows = (lineItems || []) as IntakeLineItemRow[];
      }

      const { data: externalOrders, error: externalOrderError } = await supabase
        .from("external_orders")
        .select("id, intake_artifact_id, marketplace, provider_order_id, order_date, order_total, currency")
        .in("intake_artifact_id", artifactIds);

      if (externalOrderError) {
        return NextResponse.json({ error: externalOrderError.message }, { status: 500 });
      }

      externalOrderRows = (externalOrders || []) as ExternalOrderRow[];
      const externalOrderIds = externalOrderRows.map((row) => row.id);

      if (externalOrderIds.length > 0) {
        const { data: externalOrderItems, error: externalOrderItemError } = await supabase
          .from("external_order_items")
          .select("id, external_order_id, line_index, item_title, quantity, unit_price, line_total")
          .in("external_order_id", externalOrderIds)
          .order("line_index", { ascending: true });

        if (externalOrderItemError) {
          return NextResponse.json({ error: externalOrderItemError.message }, { status: 500 });
        }

        externalOrderItemRows = (externalOrderItems || []) as ExternalOrderItemRow[];
      }

      const { data: csvBatches, error: csvBatchError } = await supabase
        .from("csv_import_batches")
        .select("id, artifact_id, status, total_rows, valid_rows, invalid_rows, duplicate_rows, applied_rows, created_at, updated_at")
        .in("artifact_id", artifactIds);

      if (csvBatchError && !isMissingRelationError(csvBatchError)) {
        return NextResponse.json({ error: csvBatchError.message }, { status: 500 });
      }

      csvBatchRows = isMissingRelationError(csvBatchError)
        ? []
        : ((csvBatches || []) as CsvImportBatchRow[]);
    }

    let rematchRunQuery = supabase
      .from("intake_rematch_runs")
      .select(
        "id, source_type, status, started_at, finished_at, matched_count, suggested_count, unmatched_count, skipped_count, reconciled_manual_count, processed_count, error_message, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (source) {
      rematchRunQuery = rematchRunQuery.eq("source_type", source);
    } else {
      rematchRunQuery = rematchRunQuery.eq("source_type", "amazon_extension");
    }

    const { data: rematchRuns, error: rematchRunsError } = await rematchRunQuery;
    if (rematchRunsError && !isMissingRelationError(rematchRunsError)) {
      return NextResponse.json({ error: rematchRunsError.message }, { status: 500 });
    }
    if (!isMissingRelationError(rematchRunsError) && rematchRuns && rematchRuns.length > 0) {
      latestRematchRun = rematchRuns[0] as IntakeRematchRunRow;
    }

    const lineItemsByExtraction = new Map<string, IntakeLineItemRow[]>();
    for (const row of lineItemRows) {
      const current = lineItemsByExtraction.get(row.extraction_id) || [];
      current.push(row);
      lineItemsByExtraction.set(row.extraction_id, current);
    }

    const extractionByArtifact = new Map<string, IntakeExtractionRow>();
    for (const extraction of extractionRows) {
      extractionByArtifact.set(extraction.artifact_id, extraction);
    }

    const matchByExtraction = new Map<string, IntakeMatchRow>();
    for (const match of matchRows) {
      matchByExtraction.set(match.extraction_id, match);
    }

    const externalOrderByArtifact = new Map<string, ExternalOrderRow>();
    for (const externalOrder of externalOrderRows) {
      externalOrderByArtifact.set(externalOrder.intake_artifact_id, externalOrder);
    }

    const externalItemsByOrder = new Map<string, ExternalOrderItemRow[]>();
    for (const row of externalOrderItemRows) {
      const current = externalItemsByOrder.get(row.external_order_id) || [];
      current.push(row);
      externalItemsByOrder.set(row.external_order_id, current);
    }

    const csvBatchByArtifact = new Map<string, CsvImportBatchRow>();
    for (const csvBatch of csvBatchRows) {
      csvBatchByArtifact.set(csvBatch.artifact_id, csvBatch);
    }

    const queue = artifactRows.map((artifact) => {
      const extraction = extractionByArtifact.get(artifact.id) || null;
      const externalOrder = externalOrderByArtifact.get(artifact.id) || null;
      const csvBatch = csvBatchByArtifact.get(artifact.id) || null;
      const match = extraction ? matchByExtraction.get(extraction.id) || null : null;
      const linkStatus = artifact.source_type === "amazon_extension" ? deriveLinkStatus(artifact.status, match) : null;

      return {
        artifact,
        extraction: extraction
          ? {
              ...extraction,
              line_items: lineItemsByExtraction.get(extraction.id) || [],
            }
          : null,
        external_order: externalOrder
          ? {
              ...externalOrder,
              items: externalItemsByOrder.get(externalOrder.id) || [],
            }
          : null,
        match,
        link_status: linkStatus,
        link_reason: match?.match_reason || null,
        csv_batch: csvBatch,
      };
    });

    return NextResponse.json({
      queue,
      meta: {
        latest_rematch_run: latestRematchRun,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch intake queue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
