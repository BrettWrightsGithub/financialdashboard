"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

type SourceFilter = "" | "upload" | "csv" | "amazon_extension";
type StatusFilter = "" | "received" | "parsed" | "matched" | "needs_review" | "ready_to_apply" | "applied" | "error";
type LinkFilter = "" | "awaiting_card_sync" | "matched_candidate" | "needs_review" | "applied";
type LinkStatus = "awaiting_card_sync" | "matched_candidate" | "needs_review" | "applied";
type ReviewAction = "confirm_match" | "reject_match" | "mark_ready_to_apply" | "mark_needs_review";

interface QueueArtifact {
  id: string;
  source_type: "upload" | "csv" | "amazon_extension";
  status: string;
  marketplace?: string | null;
  provider_order_id?: string | null;
  error_message: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  received_at: string;
  processed_at?: string | null;
}

interface QueueLineItem {
  id?: string;
  line_index: number;
  description: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
}

interface QueueExtraction {
  id: string;
  merchant_name: string | null;
  transaction_date: string | null;
  currency: string | null;
  total_amount: number | null;
  line_items?: QueueLineItem[];
}

interface QueueMatch {
  id: string;
  transaction_id: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  status: string;
  updated_at: string;
}

interface QueueExternalOrderItem {
  id?: string;
  line_index: number;
  item_title: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
}

interface QueueExternalOrder {
  id: string;
  marketplace: string;
  provider_order_id: string;
  order_date: string;
  order_total: number;
  currency: string;
  items?: QueueExternalOrderItem[];
}

interface QueueCsvBatch {
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  applied_rows: number;
}

interface QueueRematchRun {
  id: string;
  source_type: "upload" | "csv" | "amazon_extension";
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
}

interface QueueEntry {
  artifact: QueueArtifact;
  extraction: QueueExtraction | null;
  external_order?: QueueExternalOrder | null;
  match: QueueMatch | null;
  link_status: LinkStatus | null;
  link_reason: string | null;
  csv_batch: QueueCsvBatch | null;
}

interface QueueResponse {
  queue: QueueEntry[];
  meta?: {
    latest_rematch_run?: QueueRematchRun | null;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

interface RematchResponse {
  success: boolean;
  rematch: QueueRematchRun;
}

interface IntakeReviewResponse {
  success: boolean;
  artifact_id: string;
  action: ReviewAction;
}

interface DisplayItem {
  line_index: number;
  title: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "n/a";
  }

  const chosenCurrency = currency && currency.trim().length > 0 ? currency : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: chosenCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${chosenCurrency}`;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "error":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
    case "applied":
    case "ready_to_apply":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800";
    case "needs_review":
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/40 dark:text-slate-200 dark:border-slate-600";
  }
}

function linkStatusLabel(status: LinkStatus): string {
  switch (status) {
    case "awaiting_card_sync":
      return "Awaiting Card Sync";
    case "matched_candidate":
      return "Matched Candidate";
    case "needs_review":
      return "Needs Review";
    case "applied":
      return "Applied";
  }
}

function linkStatusBadgeClass(status: LinkStatus): string {
  switch (status) {
    case "awaiting_card_sync":
      return "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800";
    case "matched_candidate":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800";
    case "applied":
      return "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700/60 dark:text-slate-100 dark:border-slate-600";
    case "needs_review":
    default:
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800";
  }
}

function reviewActionLabel(action: ReviewAction): string {
  switch (action) {
    case "confirm_match":
      return "Match confirmed";
    case "reject_match":
      return "Match rejected";
    case "mark_ready_to_apply":
      return "Marked ready to apply";
    case "mark_needs_review":
      return "Marked as needs review";
  }
}

function buildDisplayItems(entry: QueueEntry): DisplayItem[] {
  if (entry.external_order?.items && entry.external_order.items.length > 0) {
    return entry.external_order.items
      .map((item) => ({
        line_index: item.line_index,
        title: item.item_title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
      }))
      .sort((left, right) => left.line_index - right.line_index);
  }

  if (entry.extraction?.line_items && entry.extraction.line_items.length > 0) {
    return entry.extraction.line_items
      .map((item) => ({
        line_index: item.line_index,
        title: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
      }))
      .sort((left, right) => left.line_index - right.line_index);
  }

  return [];
}

export default function IntakePage() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("");
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [refreshingQueue, setRefreshingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueTotal, setQueueTotal] = useState(0);
  const [latestRematchRun, setLatestRematchRun] = useState<QueueRematchRun | null>(null);
  const [runningRematch, setRunningRematch] = useState(false);
  const [rematchMessage, setRematchMessage] = useState<string | null>(null);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const [expandedArtifactIds, setExpandedArtifactIds] = useState<string[]>([]);
  const [activeReviewArtifactId, setActiveReviewArtifactId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const queueQuery = useMemo(() => {
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (sourceFilter) params.set("source", sourceFilter);
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [sourceFilter, statusFilter]);

  const loadQueue = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (mode === "initial") setLoadingQueue(true);
      if (mode === "refresh") setRefreshingQueue(true);
      setQueueError(null);

      try {
        const response = await fetch(`/api/intake/queue?${queueQuery}`);
        const body = (await response.json()) as QueueResponse | { error: string };
        if (!response.ok || !("queue" in body)) {
          throw new Error("error" in body ? body.error : "Failed to fetch intake queue");
        }

        setQueue(body.queue);
        setQueueTotal(body.pagination.total);
        setLatestRematchRun(body.meta?.latest_rematch_run || null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch intake queue";
        setQueueError(message);
      } finally {
        setLoadingQueue(false);
        setRefreshingQueue(false);
      }
    },
    [queueQuery]
  );

  useEffect(() => {
    void loadQueue("initial");
  }, [loadQueue]);

  const filteredQueue = useMemo(() => {
    if (!linkFilter) {
      return queue;
    }

    return queue.filter((entry) => entry.link_status === linkFilter);
  }, [queue, linkFilter]);

  async function uploadArtifact(file: File, sourceType: "upload" | "csv"): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source_type", sourceType);

    const response = await fetch("/api/intake/upload", {
      method: "POST",
      body: formData,
    });

    const body = (await response.json()) as { error?: string; artifact?: { id: string } };
    if (!response.ok) {
      throw new Error(body.error || "Upload failed");
    }

    setUploadMessage(`Uploaded ${file.name} (${body.artifact?.id || "artifact queued"})`);
  }

  async function handleReceiptSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      await uploadArtifact(file, "upload");
      await loadQueue("refresh");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Receipt upload failed";
      setUploadError(message);
    } finally {
      setUploadingReceipt(false);
      event.target.value = "";
    }
  }

  async function handleCsvSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      await uploadArtifact(file, "csv");
      await loadQueue("refresh");
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV upload failed";
      setUploadError(message);
    } finally {
      setUploadingCsv(false);
      event.target.value = "";
    }
  }

  async function runAmazonRematch() {
    setRunningRematch(true);
    setRematchError(null);
    setRematchMessage(null);

    try {
      const response = await fetch("/api/intake/rematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "amazon_extension",
          limit: 500,
        }),
      });

      const body = (await response.json()) as RematchResponse | { error: string };
      if (!response.ok || !("rematch" in body)) {
        throw new Error("error" in body ? body.error : "Failed to run Amazon rematch");
      }

      const summary = body.rematch;
      setRematchMessage(
        `Rematch complete. Processed ${summary.processed_count}, matched ${summary.matched_count}, needs review ${summary.suggested_count - summary.matched_count}, unmatched ${summary.unmatched_count}.`
      );
      await loadQueue("refresh");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run Amazon rematch";
      setRematchError(message);
    } finally {
      setRunningRematch(false);
    }
  }

  function toggleArtifactExpanded(artifactId: string) {
    setExpandedArtifactIds((current) => {
      if (current.includes(artifactId)) {
        return current.filter((id) => id !== artifactId);
      }
      return [...current, artifactId];
    });
  }

  async function runReviewAction(artifactId: string, action: ReviewAction) {
    setActiveReviewArtifactId(artifactId);
    setReviewError(null);
    setReviewMessage(null);

    try {
      const response = await fetch("/api/intake/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artifact_id: artifactId,
          action,
        }),
      });

      const body = (await response.json()) as IntakeReviewResponse | { error: string };
      if (!response.ok || !("success" in body)) {
        throw new Error("error" in body ? body.error : "Failed to update intake review action");
      }

      setReviewMessage(`${reviewActionLabel(action)} for ${artifactId}.`);
      await loadQueue("refresh");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update intake review action";
      setReviewError(message);
    } finally {
      setActiveReviewArtifactId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Intake Inbox</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Upload receipt photos/PDFs and CSV statements, then review and apply.
        </p>
      </div>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quick Add</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Max file size: 25 MB</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/30">
            <div className="text-sm font-medium text-slate-900 dark:text-white">Take photo / Upload receipt</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Image or PDF. Camera-first on mobile.</p>
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleReceiptSelection}
              disabled={uploadingReceipt || uploadingCsv}
              className="mt-3 block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-60"
            />
            {uploadingReceipt && <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">Uploading receipt...</p>}
          </label>

          <label className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/30">
            <div className="text-sm font-medium text-slate-900 dark:text-white">Upload CSV statement</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">CSV from unlinked account exports.</p>
            <input
              type="file"
              accept=".csv,text/csv,application/csv,application/vnd.ms-excel"
              onChange={handleCsvSelection}
              disabled={uploadingReceipt || uploadingCsv}
              className="mt-3 block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 disabled:opacity-60"
            />
            {uploadingCsv && <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">Uploading CSV...</p>}
          </label>
        </div>

        {uploadMessage && (
          <p className="text-sm rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300">
            {uploadMessage}
          </p>
        )}

        {uploadError && (
          <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {uploadError}
          </p>
        )}
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Processing Queue</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{queueTotal} artifact(s)</p>
            {latestRematchRun && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Last Amazon re-match: {formatDateTime(latestRematchRun.finished_at || latestRematchRun.started_at)} ({latestRematchRun.status})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void runAmazonRematch()}
              disabled={loadingQueue || refreshingQueue || runningRematch}
              className="rounded-lg border border-blue-700 bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {runningRematch ? "Re-matching..." : "Re-match Amazon Orders"}
            </button>
            <button
              type="button"
              onClick={() => void loadQueue("refresh")}
              disabled={loadingQueue || refreshingQueue || runningRematch}
              className="btn-secondary text-sm"
            >
              {refreshingQueue ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {rematchMessage && (
          <p className="text-sm rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300">
            {rematchMessage}
          </p>
        )}

        {rematchError && (
          <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {rematchError}
          </p>
        )}

        {reviewMessage && (
          <p className="text-sm rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300">
            {reviewMessage}
          </p>
        )}

        {reviewError && (
          <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {reviewError}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Source</label>
            <select
              className="select mt-1"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
            >
              <option value="">All sources</option>
              <option value="upload">Receipt Upload</option>
              <option value="csv">CSV Upload</option>
              <option value="amazon_extension">Amazon Extension</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Status</label>
            <select
              className="select mt-1"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="">All statuses</option>
              <option value="received">received</option>
              <option value="parsed">parsed</option>
              <option value="matched">matched</option>
              <option value="needs_review">needs_review</option>
              <option value="ready_to_apply">ready_to_apply</option>
              <option value="applied">applied</option>
              <option value="error">error</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Amazon Link Status</label>
            <select
              className="select mt-1"
              value={linkFilter}
              onChange={(event) => setLinkFilter(event.target.value as LinkFilter)}
            >
              <option value="">All</option>
              <option value="awaiting_card_sync">Awaiting Card Sync</option>
              <option value="matched_candidate">Matched Candidate</option>
              <option value="needs_review">Needs Review</option>
              <option value="applied">Applied</option>
            </select>
          </div>
        </div>

        {queueError && (
          <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {queueError}
          </p>
        )}

        {loadingQueue ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading queue...</p>
        ) : filteredQueue.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No intake artifacts match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Received</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Source</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Link</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Details</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Review</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map((entry) => {
                  const isAmazon = entry.artifact.source_type === "amazon_extension";
                  const isExpanded = expandedArtifactIds.includes(entry.artifact.id);
                  const isReviewBusy = activeReviewArtifactId === entry.artifact.id;
                  const displayItems = buildDisplayItems(entry);
                  const productPreview = displayItems.slice(0, 2).map((item) => item.title).join("; ");
                  const currency = entry.external_order?.currency || entry.extraction?.currency || "USD";
                  const detail =
                    entry.artifact.source_type === "csv"
                      ? entry.csv_batch
                        ? `${entry.csv_batch.valid_rows}/${entry.csv_batch.total_rows} valid, ${entry.csv_batch.duplicate_rows} duplicate`
                        : `${entry.artifact.mime_type || "csv"} • ${formatFileSize(entry.artifact.size_bytes)}`
                      : entry.extraction?.merchant_name
                        ? `${entry.extraction.merchant_name} • ${formatMoney(entry.extraction.total_amount, currency)}${entry.artifact.provider_order_id ? ` • Order ${entry.artifact.provider_order_id}` : ""}${productPreview ? ` • ${productPreview}` : ""}`
                        : `${entry.artifact.mime_type || "upload"} • ${formatFileSize(entry.artifact.size_bytes)}`;

                  return (
                    <Fragment key={entry.artifact.id}>
                      <tr className="border-t border-slate-200 dark:border-slate-700 align-top">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{formatDateTime(entry.artifact.received_at)}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{entry.artifact.source_type}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(entry.artifact.status)}`}>
                            {entry.artifact.status}
                          </span>
                          {entry.artifact.error_message && (
                            <p className="text-xs text-red-600 dark:text-red-300 mt-1">{entry.artifact.error_message}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {entry.link_status ? (
                            <div className="space-y-1">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${linkStatusBadgeClass(entry.link_status)}`}>
                                {linkStatusLabel(entry.link_status)}
                              </span>
                              {entry.link_reason && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">{entry.link_reason}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{detail}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleArtifactExpanded(entry.artifact.id)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {isExpanded ? "Hide" : "Review"}
                            </button>
                            {isAmazon && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void runReviewAction(entry.artifact.id, "confirm_match")}
                                  disabled={!entry.match?.transaction_id || isReviewBusy}
                                  className="rounded-md border border-emerald-700 bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void runReviewAction(entry.artifact.id, "mark_needs_review")}
                                  disabled={isReviewBusy}
                                  className="rounded-md border border-amber-600 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-500 dark:hover:bg-amber-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Needs Review
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{entry.artifact.id}</td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-slate-100 bg-slate-50/70 dark:bg-slate-900/30 dark:border-slate-700">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order Summary</p>
                                  <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                    <p>Merchant: {entry.extraction?.merchant_name || "Unknown"}</p>
                                    <p>Order Date: {entry.extraction?.transaction_date || "n/a"}</p>
                                    <p>Total: {formatMoney(entry.extraction?.total_amount, currency)}</p>
                                    <p>Order ID: {entry.artifact.provider_order_id || entry.external_order?.provider_order_id || "n/a"}</p>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Match Review</p>
                                  <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                    <p>Transaction ID: {entry.match?.transaction_id || "Not linked"}</p>
                                    <p>
                                      Confidence: {entry.match?.match_confidence !== null && entry.match?.match_confidence !== undefined
                                        ? `${Math.round(entry.match.match_confidence * 100)}%`
                                        : "n/a"}
                                    </p>
                                    <p>Status: {entry.match?.status || "none"}</p>
                                    <p>Reason: {entry.link_reason || entry.match?.match_reason || "n/a"}</p>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void runReviewAction(entry.artifact.id, "confirm_match")}
                                      disabled={!entry.match?.transaction_id || isReviewBusy}
                                      className="rounded-md border border-emerald-700 bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Confirm Match
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void runReviewAction(entry.artifact.id, "reject_match")}
                                      disabled={isReviewBusy}
                                      className="rounded-md border border-red-600 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:border-red-500 dark:hover:bg-red-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Reject Match
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void runReviewAction(entry.artifact.id, "mark_ready_to_apply")}
                                      disabled={isReviewBusy}
                                      className="rounded-md border border-blue-700 bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Mark Ready to Apply
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void runReviewAction(entry.artifact.id, "mark_needs_review")}
                                      disabled={isReviewBusy}
                                      className="rounded-md border border-amber-600 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-500 dark:hover:bg-amber-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Keep in Review
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order Items</p>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">{displayItems.length} item(s)</span>
                                </div>
                                {displayItems.length === 0 ? (
                                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No product line items parsed for this order yet.</p>
                                ) : (
                                  <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-slate-100 dark:bg-slate-800">
                                        <tr>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">#</th>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">Product</th>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">Qty</th>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">Unit</th>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {displayItems.map((item) => (
                                          <tr key={`${entry.artifact.id}-item-${item.line_index}`} className="border-t border-slate-200 dark:border-slate-700">
                                            <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{item.line_index + 1}</td>
                                            <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">{item.title || "Untitled item"}</td>
                                            <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                            <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{formatMoney(item.unit_price, currency)}</td>
                                            <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">{formatMoney(item.line_total, currency)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
