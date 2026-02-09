"use client";

import { useState, useEffect } from "react";
import { formatCurrencyPrecise } from "@/lib/cashflow";
import type { Category, TransactionWithDetails, SplitInput } from "@/types/database";
import { GroupedCategorySelect } from "./GroupedCategorySelect";
import type { AssistantAction, AssistantChatDebugInfo, AssistantChatResult } from "@/lib/assistant/types";

interface SplitModalProps {
  transaction: TransactionWithDetails;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSplitComplete: () => void;
}

interface SplitRow {
  id: string;
  amount: string;
  category_id: string;
  description: string;
}

export function SplitModal({
  transaction,
  categories,
  isOpen,
  onClose,
  onSplitComplete,
}: SplitModalProps) {
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<Array<{
    id: string;
    request: unknown;
    response: unknown;
    debug: AssistantChatDebugInfo | undefined;
  }>>([]);

  const parentAmount = Math.abs(transaction.amount);

  // Initialize with two empty splits
  useEffect(() => {
    if (isOpen) {
      setSplits([
        { id: crypto.randomUUID(), amount: "", category_id: "", description: "" },
        { id: crypto.randomUUID(), amount: "", category_id: "", description: "" },
      ]);
      setError(null);
    }
  }, [isOpen]);

  const totalSplit = splits.reduce((sum, s) => {
    const amt = parseFloat(s.amount) || 0;
    return sum + amt;
  }, 0);

  const remaining = parentAmount - totalSplit;
  const isValid = Math.abs(remaining) < 0.01 && splits.every((s) => s.amount && s.category_id);

  const handleAddSplit = () => {
    setSplits([
      ...splits,
      { id: crypto.randomUUID(), amount: "", category_id: "", description: "" },
    ]);
  };

  const handleRemoveSplit = (id: string) => {
    if (splits.length <= 2) return;
    setSplits(splits.filter((s) => s.id !== id));
  };

  const handleSplitChange = (
    id: string,
    field: keyof SplitRow,
    value: string
  ) => {
    setSplits(
      splits.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleAutoFillRemaining = (id: string) => {
    const otherTotal = splits
      .filter((s) => s.id !== id)
      .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const remaining = parentAmount - otherTotal;
    if (remaining > 0) {
      handleSplitChange(id, "amount", remaining.toFixed(2));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    try {
      const splitInputs: SplitInput[] = splits.map((s) => ({
        amount: parseFloat(s.amount),
        category_id: s.category_id,
        description: s.description || undefined,
      }));

      const res = await fetch("/api/transactions/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_id: transaction.id,
          splits: splitInputs,
        }),
      });

      // Handle response safely - check for empty body
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: "Invalid response from server" };
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to split transaction");
      }

      // Small delay to ensure database view is updated before refetch
      await new Promise(resolve => setTimeout(resolve, 300));
      
      onSplitComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to split transaction");
    } finally {
      setSaving(false);
    }
  };

  const suggestSplits = async () => {
    const prompt = assistantPrompt.trim();
    if (!prompt || assistantLoading) return;

    setAssistantLoading(true);
    setAssistantMessage(null);

    try {
      const nextMessages = [...assistantHistory, { role: "user" as const, content: prompt }];
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionHint: "propose_split",
          messages: nextMessages,
          selectedTransaction: transaction,
          debug: debugEnabled,
        }),
      });
      const payload = (await response.json()) as AssistantChatResult & { error?: string };
      const assistantReply = payload.assistant_message || payload.error || "No split suggestion returned.";
      setAssistantMessage(assistantReply);
      setAssistantHistory((prev) => [...prev, { role: "user", content: prompt }, { role: "assistant", content: assistantReply }]);
      if (debugEnabled) {
        setDebugEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            request: {
              actionHint: "propose_split",
              messages: nextMessages,
              selectedTransaction: transaction,
              debug: true,
            },
            response: payload,
            debug: payload.debug,
          },
        ]);
      }

      if (payload.action?.type === "propose_split") {
        const action = payload.action as AssistantAction<"propose_split">;
        const nextRows = action.preview.lines.map((line) => ({
          id: crypto.randomUUID(),
          amount: line.amount.toFixed(2),
          category_id: line.category_id || "",
          description: line.description || "",
        }));
        if (nextRows.length >= 2) {
          setSplits(nextRows);
        }
        if (action.preview.validation_error) {
          setError(action.preview.validation_error);
        } else {
          setError(null);
        }
      }
    } catch {
      setAssistantMessage("Failed to generate split suggestions.");
    } finally {
      setAssistantLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Split Transaction
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {transaction.description_clean || transaction.description_raw}
          </p>
        </div>

        {/* Parent Amount Display */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Total Amount
            </span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrencyPrecise(parentAmount)}
            </span>
          </div>
        </div>

        {/* Split Rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-900/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">Suggest Splits</div>
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
              <textarea
                value={assistantPrompt}
                onChange={(event) => setAssistantPrompt(event.target.value)}
                placeholder="Paste receipt lines, e.g. 'Groceries 42.10, Household 11.90'"
                className="w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs min-h-[88px]"
              />
              <button
                type="button"
                onClick={suggestSplits}
                disabled={assistantLoading || !assistantPrompt.trim()}
                className="btn-primary text-xs h-fit min-h-[44px]"
              >
                {assistantLoading ? "Parsing..." : "Suggest"}
              </button>
            </div>
            {assistantMessage && (
              <div className="text-xs text-blue-700 dark:text-blue-300">{assistantMessage}</div>
            )}
            {debugEnabled && (
              <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/10 p-2 space-y-2">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Debug trace (latest first)</div>
                {debugEntries.length === 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-400">Run Suggest to capture request/response.</div>
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

          {splits.map((split, index) => (
            <div
              key={split.id}
              className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Split {index + 1}
                </span>
                {splits.length > 2 && (
                  <button
                    onClick={() => handleRemoveSplit(split.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Amount
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={split.amount}
                      onChange={(e) =>
                        handleSplitChange(split.id, "amount", e.target.value)
                      }
                      placeholder="0.00"
                      className="input text-sm py-1.5 flex-1"
                    />
                    <button
                      onClick={() => handleAutoFillRemaining(split.id)}
                      className="px-2 text-xs bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                      title="Fill remaining amount"
                    >
                      Fill
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <GroupedCategorySelect
                    categories={categories}
                    value={split.category_id}
                    onChange={(value) =>
                      handleSplitChange(split.id, "category_id", value)
                    }
                    placeholder="Select category"
                    className="select text-sm py-1.5 w-full"
                  />
                </div>
              </div>

              {/* Optional Description */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={split.description}
                  onChange={(e) =>
                    handleSplitChange(split.id, "description", e.target.value)
                  }
                  placeholder="e.g., Groceries portion"
                  className="input text-sm py-1.5 w-full"
                />
              </div>
            </div>
          ))}

          <button
            onClick={handleAddSplit}
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-dashed border-blue-300 dark:border-blue-700"
          >
            + Add Another Split
          </button>
        </div>

        {/* Footer with totals and actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          {/* Running total */}
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Split Total:
            </span>
            <span
              className={`font-medium ${
                Math.abs(remaining) < 0.01
                  ? "text-green-600 dark:text-green-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {formatCurrencyPrecise(totalSplit)}
              {Math.abs(remaining) >= 0.01 && (
                <span className="ml-2">
                  ({remaining > 0 ? "+" : ""}
                  {formatCurrencyPrecise(remaining)} remaining)
                </span>
              )}
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Splitting..." : "Split Transaction"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
