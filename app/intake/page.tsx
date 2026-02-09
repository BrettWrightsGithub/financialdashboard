"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

type SourceFilter = "" | "upload" | "csv" | "amazon_extension";
type StatusFilter = "" | "received" | "parsed" | "matched" | "needs_review" | "ready_to_apply" | "applied" | "error";

interface QueueArtifact {
  id: string;
  source_type: "upload" | "csv" | "amazon_extension";
  status: string;
  error_message: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  received_at: string;
}

interface QueueExtraction {
  merchant_name: string | null;
  transaction_date: string | null;
  total_amount: number | null;
}

interface QueueCsvBatch {
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  applied_rows: number;
}

interface QueueEntry {
  artifact: QueueArtifact;
  extraction: QueueExtraction | null;
  csv_batch: QueueCsvBatch | null;
}

interface QueueResponse {
  queue: QueueEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

function formatFileSize(bytes: number | null): string {
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

export default function IntakePage() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [refreshingQueue, setRefreshingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueTotal, setQueueTotal] = useState(0);
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
          </div>
          <button
            type="button"
            onClick={() => void loadQueue("refresh")}
            disabled={loadingQueue || refreshingQueue}
            className="btn-secondary text-sm"
          >
            {refreshingQueue ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        </div>

        {queueError && (
          <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {queueError}
          </p>
        )}

        {loadingQueue ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading queue...</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No intake artifacts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Received</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Source</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Details</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">ID</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => {
                  const detail =
                    entry.artifact.source_type === "csv"
                      ? entry.csv_batch
                        ? `${entry.csv_batch.valid_rows}/${entry.csv_batch.total_rows} valid, ${entry.csv_batch.duplicate_rows} duplicate`
                        : `${entry.artifact.mime_type || "csv"} • ${formatFileSize(entry.artifact.size_bytes)}`
                      : entry.extraction?.merchant_name
                        ? `${entry.extraction.merchant_name} • ${entry.extraction.total_amount ?? "n/a"}`
                        : `${entry.artifact.mime_type || "upload"} • ${formatFileSize(entry.artifact.size_bytes)}`;

                  return (
                    <tr key={entry.artifact.id} className="border-t border-slate-200 dark:border-slate-700 align-top">
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
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{detail}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{entry.artifact.id}</td>
                    </tr>
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
