"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category } from "@/types/database";
import type { TransactionWithDetails } from "@/types/database";
import type { GlobalFilterState } from "./GlobalFilters";
import { GroupedCategorySelect } from "./GroupedCategorySelect";
import type { AssistantAction, AssistantChatDebugInfo, AssistantChatResult } from "@/lib/assistant/types";

interface ReviewQueueProps {
  filters: GlobalFilterState;
  categories: Category[];
  selectedIds: Set<string>;
  onSelectedIdsChange: (value: Set<string>) => void;
  onSelectTransaction: (transaction: TransactionWithDetails | null) => void;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function suggestionToCategoryId(transaction: TransactionWithDetails, categories: Category[]): string {
  const suggestion = normalizeText(transaction.category_ai || transaction.category_name || "");
  if (!suggestion) return "";

  const exact = categories.find((category) => normalizeText(category.name) === suggestion);
  if (exact) return exact.id;

  const tokens = suggestion.split(" ").filter(Boolean);
  let best: { id: string; score: number } | null = null;
  for (const category of categories) {
    const categoryText = normalizeText(category.name);
    const score = tokens.reduce((acc, token) => acc + (categoryText.includes(token) ? 1 : 0), 0);
    if (!best || score > best.score) {
      best = { id: category.id, score };
    }
  }
  return best && best.score > 0 ? best.id : "";
}

function suggestionToLabel(transaction: TransactionWithDetails, categories: Category[]): string {
  const id = suggestionToCategoryId(transaction, categories);
  if (id) {
    return categories.find((category) => category.id === id)?.name || "No suggestion";
  }
  const raw = transaction.category_ai || transaction.category_name || "";
  if (!raw) return "No suggestion";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ReviewQueue({
  filters,
  categories,
  selectedIds,
  onSelectedIdsChange,
  onSelectTransaction,
}: ReviewQueueProps) {
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [pendingCategoryId, setPendingCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [bulkActionPreview, setBulkActionPreview] = useState<AssistantAction<"bulk_edit_transactions"> | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<Array<{
    id: string;
    request: unknown;
    response: unknown;
    debug: AssistantChatDebugInfo | undefined;
  }>>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await fetch("/api/review-queue?sortBy=confidence&sortOrder=asc");
      const payload = await response.json();
      setTransactions(payload.transactions || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    setVisibleCount(10);
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    const search = filters.searchQuery.trim().toLowerCase();

    return transactions
      .filter((transaction) => {
        if (transaction.date < filters.dateRange.start || transaction.date > filters.dateRange.end) return false;
        if (filters.accountId && transaction.account_id !== filters.accountId) return false;
        if (filters.cashflowGroup && transaction.cashflow_group !== filters.cashflowGroup) return false;
        if (filters.hideTransfers && transaction.is_transfer) return false;
        if (filters.hidePassThrough && transaction.is_pass_through) return false;

        if (search) {
          const blob =
            `${transaction.description_raw} ${transaction.description_clean || ""} ${transaction.account_name || ""} ${transaction.category_name || ""} ${transaction.category_ai || ""}`.toLowerCase();
          if (!blob.includes(search)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const confA = a.category_confidence ?? 0;
        const confB = b.category_confidence ?? 0;
        if (confA !== confB) return confA - confB;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [filters, transactions]);

  const processedTransactions = filteredTransactions.filter((transaction) => processedIds.has(transaction.id));
  const activeFilteredTransactions = filteredTransactions.filter((transaction) => !processedIds.has(transaction.id));
  const activeTransactions = activeFilteredTransactions.slice(0, visibleCount);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedIdsChange(next);
  };

  const selectedTransactions = useMemo(
    () => filteredTransactions.filter((transaction) => selectedIds.has(transaction.id)),
    [filteredTransactions, selectedIds]
  );

  useEffect(() => {
    if (selectedTransactions.length === 0) {
      setPendingCategoryId("");
      return;
    }

    const suggestionIds = selectedTransactions
      .map((transaction) => suggestionToCategoryId(transaction, categories))
      .filter(Boolean);

    if (suggestionIds.length === 0) {
      setPendingCategoryId("");
      return;
    }

    const first = suggestionIds[0];
    const allSame = suggestionIds.every((id) => id === first);
    if (allSame) {
      setPendingCategoryId(first);
    } else {
      setPendingCategoryId("");
    }
  }, [categories, selectedTransactions]);

  const confirmCategory = async () => {
    if (!pendingCategoryId || selectedIds.size === 0) return;
    setSaving(true);
    await fetch("/api/transactions/bulk-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign_category",
        transaction_ids: Array.from(selectedIds),
        category_id: pendingCategoryId,
        learn_payee: true,
      }),
    });
    setProcessedIds((prev) => new Set([...prev, ...selectedIds]));
    onSelectedIdsChange(new Set());
    setPendingCategoryId("");
    setSaving(false);
  };

  const generateCommandPreview = async () => {
    const prompt = assistantPrompt.trim();
    if (!prompt || assistantLoading) return;

    setAssistantLoading(true);
    setAssistantMessage(null);
    setBulkActionPreview(null);

    try {
      const nextMessages = [...assistantHistory, { role: "user" as const, content: prompt }];
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionHint: "bulk_edit_transactions",
          messages: nextMessages,
          selectedTransactionIds: Array.from(selectedIds),
          debug: debugEnabled,
        }),
      });
      const payload = (await response.json()) as AssistantChatResult & { error?: string };
      const assistantReply = payload.assistant_message || payload.error || "No preview generated.";
      setAssistantMessage(assistantReply);
      setAssistantHistory((prev) => [...prev, { role: "user", content: prompt }, { role: "assistant", content: assistantReply }]);
      if (payload.action?.type === "bulk_edit_transactions") {
        setBulkActionPreview(payload.action as AssistantAction<"bulk_edit_transactions">);
      }
      if (debugEnabled) {
        setDebugEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            request: {
              actionHint: "bulk_edit_transactions",
              messages: nextMessages,
              selectedTransactionIds: Array.from(selectedIds),
              debug: true,
            },
            response: payload,
            debug: payload.debug,
          },
        ]);
      }
    } catch {
      setAssistantMessage("Failed to generate command preview.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const applyBulkActionPreview = async () => {
    if (!bulkActionPreview) return;
    setSaving(true);
    setAssistantMessage(null);

    try {
      await fetch("/api/transactions/bulk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkActionPreview.preview.payload),
      });
      setProcessedIds((prev) => new Set([...prev, ...bulkActionPreview.preview.transaction_ids]));
      onSelectedIdsChange(new Set());
      setAssistantPrompt("");
      setBulkActionPreview(null);
      setAssistantMessage("Bulk command applied.");
    } catch {
      setAssistantMessage("Failed to apply bulk command.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="w-full px-4 py-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full flex items-center justify-between text-left min-h-[44px]"
        >
          <span className="font-semibold">Review Queue</span>
          <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-1">{filteredTransactions.length - processedTransactions.length}</span>
        </button>

        {processedTransactions.length > 0 && (
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs min-h-[44px]"
            onClick={() => setShowProcessed((prev) => !prev)}
          >
            <span>{showProcessed ? "Hide" : "Show"} Processed ({processedTransactions.length})</span>
            <span className="font-semibold">✓</span>
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-300">{selectedIds.size} selected</span>
          <GroupedCategorySelect
            categories={categories}
            value={pendingCategoryId}
            onChange={setPendingCategoryId}
            placeholder="Select category"
            className="select text-xs w-auto min-h-[44px]"
          />
          <button
            type="button"
            className="btn-primary text-xs min-h-[44px]"
            onClick={confirmCategory}
            disabled={!pendingCategoryId || selectedIds.size === 0 || saving}
          >
            {saving ? "Saving..." : "Confirm Selected"}
          </button>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-900/10 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">Bulk Command Assistant</div>
            <button
              type="button"
              className={`text-xs px-2 py-1 rounded-md border ${
                debugEnabled
                  ? "border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20"
                  : "border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
              }`}
              onClick={() => setDebugEnabled((prev) => !prev)}
            >
              Debug {debugEnabled ? "On" : "Off"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={assistantPrompt}
              onChange={(event) => setAssistantPrompt(event.target.value)}
              placeholder="e.g., Mark selected as Groceries and learn payee"
              className="flex-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs min-h-[44px]"
            />
            <button
              type="button"
              onClick={generateCommandPreview}
              disabled={assistantLoading || !assistantPrompt.trim() || selectedIds.size === 0}
              className="btn-primary text-xs min-h-[44px]"
            >
              {assistantLoading ? "Parsing..." : "Preview"}
            </button>
          </div>
          {assistantMessage && (
            <div className="text-xs text-blue-700 dark:text-blue-300">{assistantMessage}</div>
          )}
          {bulkActionPreview && (
            <div className="rounded border border-blue-200 dark:border-blue-800 bg-white/70 dark:bg-slate-900/40 p-2 space-y-2">
              <div className="text-xs text-slate-700 dark:text-slate-300">{bulkActionPreview.preview.summary}</div>
              <button
                type="button"
                onClick={applyBulkActionPreview}
                disabled={saving}
                className="btn-primary text-xs min-h-[44px]"
              >
                {saving ? "Applying..." : "Confirm Assistant Command"}
              </button>
            </div>
          )}
          {debugEnabled && (
            <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/10 p-2 space-y-2">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Debug trace (latest first)</div>
              {debugEntries.length === 0 && (
                <div className="text-xs text-amber-700 dark:text-amber-400">Run Preview to capture request/response.</div>
              )}
              {debugEntries.slice(-2).reverse().map((entry) => (
                <details key={entry.id}>
                  <summary className="text-[11px] cursor-pointer text-amber-700 dark:text-amber-300">
                    Prompt: {entry.debug?.contextual_prompt || "N/A"}
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto text-[10px] whitespace-pre-wrap break-all">
                    {JSON.stringify({ request: entry.request, response: entry.response, debug: entry.debug }, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {loading && <div className="text-sm text-slate-500">Loading review queue…</div>}

          {!loading && filteredTransactions.length === 0 && (
            <div className="text-sm text-slate-500">No items need review.</div>
          )}

          {!loading && processedTransactions.length > 0 && showProcessed && (
            <div className="pb-2 border-b border-slate-200 dark:border-slate-700 space-y-2">
              {processedTransactions.map((transaction) => (
                <div
                  key={`processed-${transaction.id}`}
                  className="border border-slate-300 dark:border-slate-700 opacity-60 bg-slate-100/60 dark:bg-slate-800/30 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{transaction.description_clean || transaction.description_raw}</div>
                      <div className="text-xs text-slate-500">{transaction.account_name} • {transaction.date}</div>
                    </div>
                    <div className="text-sm font-semibold">{transaction.amount.toFixed(2)}</div>
                  </div>
                  <div className="mt-2 text-xs text-green-700 dark:text-green-300">Saved ✓</div>
                </div>
              ))}
            </div>
          )}

          {!loading && activeTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className={`border rounded-lg p-3 flex flex-col gap-2 ${
                selectedIds.has(transaction.id)
                  ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900"
                  : "border-amber-200 dark:border-amber-900"
              }`}
              onClick={() => {
                onSelectTransaction(transaction);
                toggleSelection(transaction.id);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedIds.has(transaction.id)}
                    onChange={(event) => {
                      event.stopPropagation();
                      toggleSelection(transaction.id);
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <div>
                  <div className="text-sm font-medium">{transaction.description_clean || transaction.description_raw}</div>
                  <div className="text-xs text-slate-500">{transaction.account_name} • {transaction.date}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold">{transaction.amount.toFixed(2)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">
                  {(transaction.category_confidence ?? 0) > 0 ? `AI ${Math.round((transaction.category_confidence || 0) * 100)}%` : "No confidence"}
                </span>
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  Suggested: {suggestionToLabel(transaction, categories)}
                </span>
              </div>
            </div>
          ))}

          {!loading && activeFilteredTransactions.length > 10 && (
            <div className="flex items-center gap-2">
              {visibleCount < activeFilteredTransactions.length ? (
                <button
                  type="button"
                  className="btn-secondary text-xs min-h-[44px]"
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 10, activeFilteredTransactions.length))}
                >
                  Show More
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary text-xs min-h-[44px]"
                  onClick={() => setVisibleCount(10)}
                >
                  Show Top 10
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
