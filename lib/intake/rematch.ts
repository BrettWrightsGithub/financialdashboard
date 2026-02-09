import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntakeSourceType } from "@/types/database";

type SupabaseLike = Pick<SupabaseClient, "from">;

interface ArtifactRow {
  id: string;
  source_type: IntakeSourceType;
  status: string;
  provider_order_id: string | null;
}

interface ExtractionRow {
  id: string;
  artifact_id: string;
  transaction_date: string | null;
  total_amount: number | null;
  merchant_name: string | null;
}

interface MatchRow {
  id: string;
  extraction_id: string;
  status: string;
  transaction_id: string | null;
  match_confidence: number | null;
  match_reason: string | null;
}

interface TransactionCandidate {
  id: string;
  amount: number;
  date: string;
  description_raw: string;
  status: string;
  is_split_child: boolean | null;
  is_split_parent: boolean | null;
  provider: string;
}

interface ScoredCandidate {
  candidate: TransactionCandidate;
  score: number;
  reason: string;
}

export interface IntakeRematchOptions {
  sourceType: IntakeSourceType;
  limit?: number;
}

export interface IntakeRematchSummary {
  run_id: string;
  source_type: IntakeSourceType;
  processed_count: number;
  matched_count: number;
  suggested_count: number;
  unmatched_count: number;
  skipped_count: number;
  reconciled_manual_count: number;
  started_at: string;
  finished_at: string;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function dayDiff(from: Date, to: Date): number {
  return Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

function getTolerance(totalAmount: number): number {
  return Math.max(1.5, totalAmount * 0.15);
}

function isManualProvider(provider: string | null | undefined): boolean {
  if (!provider) {
    return false;
  }
  return provider.toLowerCase().startsWith("manual");
}

function scoreTransactionCandidate(
  extraction: ExtractionRow,
  candidate: TransactionCandidate
): ScoredCandidate | null {
  if (!extraction.transaction_date || extraction.total_amount === null || extraction.total_amount <= 0) {
    return null;
  }

  const extractionDate = normalizeDate(extraction.transaction_date);
  const candidateDate = normalizeDate(candidate.date);
  if (!extractionDate || !candidateDate) {
    return null;
  }

  const absAmount = Math.abs(candidate.amount);
  const amountDelta = Math.abs(absAmount - extraction.total_amount);
  const tolerance = getTolerance(extraction.total_amount);

  if (amountDelta > tolerance) {
    return null;
  }

  const amountScore = clamp01(1 - amountDelta / Math.max(extraction.total_amount, 1));
  const dateDistance = dayDiff(extractionDate, candidateDate);
  const dateScore = clamp01(1 - dateDistance / 7);

  const description = (candidate.description_raw || "").toLowerCase();
  const merchant = (extraction.merchant_name || "").toLowerCase();
  const amazonSignal = description.includes("amazon") || description.includes("amzn");
  const merchantSignal = merchant ? description.includes(merchant) : false;
  const merchantScore = amazonSignal || merchantSignal ? 1 : 0.45;

  const splitPenalty = candidate.is_split_child || candidate.is_split_parent ? 0.15 : 0;

  const score = clamp01(amountScore * 0.55 + dateScore * 0.25 + merchantScore * 0.2 - splitPenalty);

  const reason = `amountΔ=${amountDelta.toFixed(2)}, dayΔ=${dateDistance.toFixed(1)}, merchant=${merchantScore.toFixed(2)}`;

  return {
    candidate,
    score,
    reason,
  };
}

async function getMatchedTransaction(
  supabase: SupabaseLike,
  transactionId: string
): Promise<{ id: string; provider: string; status: string } | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, provider, status")
    .eq("id", transactionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function fetchCandidates(
  supabase: SupabaseLike,
  extraction: ExtractionRow
): Promise<ScoredCandidate[]> {
  if (!extraction.transaction_date) {
    return [];
  }

  const orderDate = normalizeDate(extraction.transaction_date);
  if (!orderDate) {
    return [];
  }

  const dateFrom = new Date(orderDate);
  dateFrom.setDate(dateFrom.getDate() - 7);

  const dateTo = new Date(orderDate);
  dateTo.setDate(dateTo.getDate() + 7);

  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount, date, description_raw, status, is_split_child, is_split_parent, provider")
    .eq("status", "posted")
    .gte("date", dateFrom.toISOString().slice(0, 10))
    .lte("date", dateTo.toISOString().slice(0, 10));

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as TransactionCandidate[])
    .filter((candidate) => candidate.amount < 0)
    .map((candidate) => scoreTransactionCandidate(extraction, candidate))
    .filter((scored): scored is ScoredCandidate => Boolean(scored))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function classifyMatch(
  scored: ScoredCandidate[]
): {
  status: "matched" | "needs_review" | "unmatched";
  matchStatus: "suggested" | "unmatched";
  transactionId: string | null;
  confidence: number | null;
  reason: string;
} {
  if (!scored.length) {
    return {
      status: "needs_review",
      matchStatus: "unmatched",
      transactionId: null,
      confidence: null,
      reason: "No candidate transaction within +/-7 days and amount tolerance.",
    };
  }

  const [best, second] = scored;
  const bestScore = best.score;
  const scoreGap = second ? best.score - second.score : best.score;

  if (bestScore >= 0.9 && scoreGap >= 0.1) {
    return {
      status: "matched",
      matchStatus: "suggested",
      transactionId: best.candidate.id,
      confidence: bestScore,
      reason: `High-confidence candidate (${best.reason})`,
    };
  }

  if (bestScore >= 0.72) {
    return {
      status: "needs_review",
      matchStatus: "suggested",
      transactionId: best.candidate.id,
      confidence: bestScore,
      reason: `Needs review: medium confidence (${best.reason})`,
    };
  }

  return {
    status: "needs_review",
    matchStatus: "unmatched",
    transactionId: null,
    confidence: null,
    reason: "Low confidence candidates only; manual review required.",
  };
}

async function hasSyncedCardTransactions(supabase: SupabaseLike): Promise<boolean> {
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "posted")
    .neq("provider", "manual");

  if (error) {
    return true;
  }

  return Boolean(count && count > 0);
}

export async function runIntakeRematch(
  supabase: SupabaseLike,
  options: IntakeRematchOptions
): Promise<IntakeRematchSummary> {
  const now = new Date().toISOString();
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 1000);

  const { data: runStart, error: runStartError } = await supabase
    .from("intake_rematch_runs")
    .insert({
      source_type: options.sourceType,
      status: "running",
      started_at: now,
      updated_at: now,
    })
    .select("id, started_at")
    .single();

  if (runStartError || !runStart?.id) {
    throw new Error(`Failed to create rematch run: ${runStartError?.message || "missing run id"}`);
  }

  const runId = runStart.id as string;
  const startedAt = (runStart.started_at as string) || now;

  const summary = {
    processed_count: 0,
    matched_count: 0,
    suggested_count: 0,
    unmatched_count: 0,
    skipped_count: 0,
    reconciled_manual_count: 0,
  };

  try {
    const { data: artifacts, error: artifactsError } = await supabase
      .from("intake_artifacts")
      .select("id, source_type, status, provider_order_id")
      .eq("source_type", options.sourceType)
      .in("status", ["parsed", "matched", "needs_review", "ready_to_apply"])
      .order("received_at", { ascending: false })
      .limit(limit);

    if (artifactsError) {
      throw new Error(`Failed to load intake artifacts: ${artifactsError.message}`);
    }

    const artifactRows = (artifacts || []) as ArtifactRow[];
    if (!artifactRows.length) {
      const finishedAt = new Date().toISOString();
      await supabase
        .from("intake_rematch_runs")
        .update({
          status: "success",
          finished_at: finishedAt,
          updated_at: finishedAt,
          ...summary,
        })
        .eq("id", runId);

      return {
        run_id: runId,
        source_type: options.sourceType,
        ...summary,
        started_at: startedAt,
        finished_at: finishedAt,
      };
    }

    const artifactIds = artifactRows.map((artifact) => artifact.id);

    const { data: extractions, error: extractionError } = await supabase
      .from("intake_extractions")
      .select("id, artifact_id, transaction_date, total_amount, merchant_name")
      .in("artifact_id", artifactIds);

    if (extractionError) {
      throw new Error(`Failed to load intake extractions: ${extractionError.message}`);
    }

    const extractionRows = (extractions || []) as ExtractionRow[];
    const extractionIds = extractionRows.map((extraction) => extraction.id);

    const { data: matches, error: matchesError } = extractionIds.length
      ? await supabase
          .from("intake_matches")
          .select("id, extraction_id, status, transaction_id, match_confidence, match_reason")
          .in("extraction_id", extractionIds)
      : { data: [], error: null };

    if (matchesError) {
      throw new Error(`Failed to load intake matches: ${matchesError.message}`);
    }

    const matchByExtraction = new Map<string, MatchRow>();
    for (const row of (matches || []) as MatchRow[]) {
      matchByExtraction.set(row.extraction_id, row);
    }

    const syncedCardTransactionsAvailable = await hasSyncedCardTransactions(supabase);
    const artifactByExtraction = new Map<string, ArtifactRow>();

    for (const extraction of extractionRows) {
      const artifact = artifactRows.find((item) => item.id === extraction.artifact_id);
      if (artifact) {
        artifactByExtraction.set(extraction.id, artifact);
      }
    }

    for (const extraction of extractionRows) {
      summary.processed_count += 1;
      const artifact = artifactByExtraction.get(extraction.id);
      if (!artifact) {
        summary.skipped_count += 1;
        continue;
      }

      const existingMatch = matchByExtraction.get(extraction.id) || null;
      if (existingMatch?.status === "applied") {
        summary.skipped_count += 1;
        continue;
      }

      const scored = await fetchCandidates(supabase, extraction);
      const classification = classifyMatch(scored);

      let finalReason = classification.reason;
      const finalTransactionId = classification.transactionId;
      let finalStatus = classification.matchStatus;
      let finalArtifactStatus = classification.status;
      const finalConfidence = classification.confidence;

      if (!scored.length && !syncedCardTransactionsAvailable) {
        finalStatus = "unmatched";
        finalArtifactStatus = "parsed";
        finalReason = "No synced card transactions found. Sync your card account first.";
      }

      if (existingMatch?.transaction_id && finalTransactionId && existingMatch.transaction_id !== finalTransactionId) {
        const previousTransaction = await getMatchedTransaction(supabase, existingMatch.transaction_id);
        const replacementTransaction = await getMatchedTransaction(supabase, finalTransactionId);

        if (
          previousTransaction &&
          replacementTransaction &&
          isManualProvider(previousTransaction.provider) &&
          !isManualProvider(replacementTransaction.provider) &&
          (finalConfidence ?? 0) >= 0.9
        ) {
          await supabase
            .from("transactions")
            .update({
              status: "archived",
              updated_at: new Date().toISOString(),
            })
            .eq("id", previousTransaction.id)
            .eq("status", "posted");

          finalReason = `${finalReason} Reconciled prior manual transaction ${previousTransaction.id}.`;
          summary.reconciled_manual_count += 1;
        }
      }

      const updatedAt = new Date().toISOString();

      const matchPayload = {
        extraction_id: extraction.id,
        transaction_id: finalTransactionId,
        match_confidence: finalConfidence,
        match_reason: finalReason,
        status: finalStatus,
        updated_at: updatedAt,
      };

      const { error: matchUpsertError } = await supabase
        .from("intake_matches")
        .upsert(matchPayload, { onConflict: "extraction_id" });

      if (matchUpsertError) {
        throw new Error(`Failed to update intake match for extraction ${extraction.id}: ${matchUpsertError.message}`);
      }

      const { error: artifactUpdateError } = await supabase
        .from("intake_artifacts")
        .update({ status: finalArtifactStatus, updated_at: updatedAt })
        .eq("id", artifact.id);

      if (artifactUpdateError) {
        throw new Error(`Failed to update artifact status for ${artifact.id}: ${artifactUpdateError.message}`);
      }

      if (finalStatus === "suggested") {
        summary.suggested_count += 1;
        if (finalArtifactStatus === "matched") {
          summary.matched_count += 1;
        }
      } else {
        summary.unmatched_count += 1;
      }
    }

    const finishedAt = new Date().toISOString();
    await supabase
      .from("intake_rematch_runs")
      .update({
        status: "success",
        finished_at: finishedAt,
        updated_at: finishedAt,
        ...summary,
      })
      .eq("id", runId);

    return {
      run_id: runId,
      source_type: options.sourceType,
      ...summary,
      started_at: startedAt,
      finished_at: finishedAt,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Rematch failed";

    await supabase
      .from("intake_rematch_runs")
      .update({
        status: "error",
        error_message: message,
        finished_at: finishedAt,
        updated_at: finishedAt,
        ...summary,
      })
      .eq("id", runId);

    throw new Error(message);
  }
}
