"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/cashflow";
import { getExpectedInflows } from "@/lib/queries";
import { InlineEditCell } from "./InlineEditCell";
import type { ExpectedInflow } from "@/types/database";
import type { AssistantAction, AssistantChatDebugInfo, AssistantChatResult } from "@/lib/assistant/types";

interface ExpectedInflowsSectionProps {
  month: string;
  className?: string;
}

export function ExpectedInflowsSection({
  month,
  className = "",
}: ExpectedInflowsSectionProps) {
  const [inflows, setInflows] = useState<ExpectedInflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newInflow, setNewInflow] = useState({
    source: "",
    expected_amount: "",
    notes: "",
    counterparty_id: "",
    category_id: "",
    expected_date: "",
    recurrence: "",
  });
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [assistantPreview, setAssistantPreview] = useState<AssistantAction<"create_expected_inflow"> | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<Array<{
    id: string;
    request: unknown;
    response: unknown;
    debug: AssistantChatDebugInfo | undefined;
  }>>([]);

  useEffect(() => {
    fetchInflows();
  }, [month]);

  const fetchInflows = async () => {
    setIsLoading(true);
    try {
      const data = await getExpectedInflows(month);
      setInflows(data);
    } catch (error) {
      console.error("Error fetching expected inflows:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAmount = async (inflowId: string, newAmount: number) => {
    try {
      const response = await fetch(`/api/expected-inflows`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: inflowId,
          expected_amount: newAmount,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update inflow amount");
      }

      const { data } = await response.json();
      
      // Update local state
      setInflows((prev) =>
        prev.map((inflow) =>
          inflow.id === inflowId ? { ...inflow, ...data } : inflow
        )
      );
    } catch (error) {
      console.error("Error updating inflow amount:", error);
      throw error;
    }
  };

  const handleDeleteInflow = async (inflowId: string) => {
    if (!confirm("Are you sure you want to delete this expected inflow?")) {
      return;
    }

    try {
      const response = await fetch(`/api/expected-inflows?id=${inflowId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete inflow");
      }

      // Update local state
      setInflows((prev) => prev.filter((inflow) => inflow.id !== inflowId));
    } catch (error) {
      console.error("Error deleting inflow:", error);
    }
  };

  const handleAddInflow = async () => {
    if (!newInflow.source.trim() || !newInflow.expected_amount) {
      return;
    }

    const amount = parseFloat(newInflow.expected_amount.replace(/[^0-9.-]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    try {
      const response = await fetch("/api/expected-inflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: newInflow.source.trim(),
          expected_amount: amount,
          month,
          notes: newInflow.notes.trim() || null,
          counterparty_id: newInflow.counterparty_id || null,
          category_id: newInflow.category_id || null,
          expected_date: newInflow.expected_date || null,
          recurrence: newInflow.recurrence || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add inflow");
      }

      const { data } = await response.json();
      
      // Update local state
      setInflows((prev) => [...prev, data]);
      
      // Reset form
      setNewInflow({
        source: "",
        expected_amount: "",
        notes: "",
        counterparty_id: "",
        category_id: "",
        expected_date: "",
        recurrence: "",
      });
      setIsAddingNew(false);
      setAssistantPrompt("");
      setAssistantPreview(null);
      setAssistantMessage(null);
    } catch (error) {
      console.error("Error adding inflow:", error);
    }
  };

  const handleCancelAdd = () => {
    setNewInflow({
      source: "",
      expected_amount: "",
      notes: "",
      counterparty_id: "",
      category_id: "",
      expected_date: "",
      recurrence: "",
    });
    setIsAddingNew(false);
    setAssistantPreview(null);
    setAssistantMessage(null);
  };

  const generateInflowFromPrompt = async () => {
    const prompt = assistantPrompt.trim();
    if (!prompt || assistantLoading) return;

    setAssistantLoading(true);
    setAssistantMessage(null);
    setAssistantPreview(null);

    try {
      const nextMessages = [...assistantHistory, { role: "user" as const, content: prompt }];
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionHint: "create_expected_inflow",
          month,
          messages: nextMessages,
          debug: debugEnabled,
        }),
      });
      const payload = (await response.json()) as AssistantChatResult & { error?: string };
      const assistantReply = payload.assistant_message || payload.error || "No parsed inflow was returned.";
      setAssistantMessage(assistantReply);
      setAssistantHistory((prev) => [...prev, { role: "user", content: prompt }, { role: "assistant", content: assistantReply }]);
      if (debugEnabled) {
        setDebugEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            request: {
              actionHint: "create_expected_inflow",
              month,
              messages: nextMessages,
              debug: true,
            },
            response: payload,
            debug: payload.debug,
          },
        ]);
      }
      if (payload.action?.type === "create_expected_inflow") {
        const action = payload.action as AssistantAction<"create_expected_inflow">;
        setAssistantPreview(action);
        setIsAddingNew(true);
      }
    } catch {
      setAssistantMessage("Failed to parse inflow prompt.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const applyAssistantPreviewToForm = () => {
    if (!assistantPreview) return;
    const preview = assistantPreview.preview;
    setNewInflow({
      source: preview.source,
      expected_amount: preview.expected_amount.toFixed(2),
      notes: preview.notes || "",
      counterparty_id: preview.counterparty_id || "",
      category_id: preview.category_id || "",
      expected_date: preview.expected_date || "",
      recurrence: preview.recurrence || "",
    });
    setIsAddingNew(true);
  };

  const totalExpected = inflows.reduce((sum, inflow) => sum + inflow.expected_amount, 0);

  if (isLoading) {
    return (
      <div className={`card p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Expected Inflows
        </h3>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Total: <span className="font-semibold">{formatCurrency(totalExpected)}</span>
          </div>
          <button
            onClick={() => setIsAddingNew(true)}
            disabled={isAddingNew}
            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed rounded-md
                     transition-colors duration-150 ease-in-out"
          >
            Add Inflow
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-900/10 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">Prompt Assistant</div>
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
            type="text"
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
            placeholder="e.g., Add monthly rent from Stephanie, $1200, due 1st"
            className="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
          <button
            onClick={generateInflowFromPrompt}
            disabled={assistantLoading || !assistantPrompt.trim()}
            className="btn-primary text-xs min-h-[44px]"
          >
            {assistantLoading ? "Parsing..." : "Preview"}
          </button>
        </div>
        {assistantMessage && (
          <div className="text-xs text-blue-700 dark:text-blue-300">{assistantMessage}</div>
        )}
        {assistantPreview && (
          <div className="rounded border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-slate-900/40 p-2">
            <div className="text-xs text-slate-700 dark:text-slate-300">
              {assistantPreview.preview.source} • ${assistantPreview.preview.expected_amount.toFixed(2)}
              {assistantPreview.preview.expected_date ? ` • due ${assistantPreview.preview.expected_date}` : ""}
              {assistantPreview.preview.category_name ? ` • ${assistantPreview.preview.category_name}` : ""}
              {assistantPreview.preview.counterparty_name ? ` • from ${assistantPreview.preview.counterparty_name}` : ""}
            </div>
            <button
              onClick={applyAssistantPreviewToForm}
              className="mt-2 btn-primary text-xs min-h-[44px]"
            >
              Use This Draft
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

      {inflows.length === 0 && !isAddingNew ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <p className="mb-2">No expected inflows for this month.</p>
          <p className="text-sm">Add expected income like rent, reimbursements, or other sources.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Existing Inflows */}
          {inflows.map((inflow) => (
            <div
              key={inflow.id}
              className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium text-slate-900 dark:text-white">
                  {inflow.source}
                </div>
                {inflow.counterparties?.name && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    From: {inflow.counterparties.name}
                  </div>
                )}
                {inflow.notes && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {inflow.notes}
                  </div>
                )}
              </div>
              
              <div className="w-32">
                <InlineEditCell
                  value={inflow.expected_amount}
                  onSave={(newAmount) => handleUpdateAmount(inflow.id, newAmount)}
                  testId={`inflow-amount-${inflow.id}`}
                />
              </div>

              <div className="text-sm text-slate-500 dark:text-slate-400">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  inflow.status === "received" 
                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                    : inflow.status === "partial"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                    : inflow.status === "missed"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {inflow.status || "pending"}
                </span>
              </div>

              <button
                onClick={() => handleDeleteInflow(inflow.id)}
                className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400
                         transition-colors duration-150 ease-in-out"
                title="Delete inflow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add New Inflow Form */}
          {isAddingNew && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Source *
                  </label>
                  <input
                    type="text"
                    value={newInflow.source}
                    onChange={(e) => setNewInflow({ ...newInflow, source: e.target.value })}
                    placeholder="e.g., Rent, T-Mobile Reimbursement"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                             bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Expected Amount *
                  </label>
                  <input
                    type="text"
                    value={newInflow.expected_amount}
                    onChange={(e) => setNewInflow({ ...newInflow, expected_amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                             bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newInflow.notes}
                    onChange={(e) => setNewInflow({ ...newInflow, notes: e.target.value })}
                    placeholder="Optional notes..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                             bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {(newInflow.expected_date || newInflow.recurrence || newInflow.category_id || newInflow.counterparty_id) && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {newInflow.expected_date ? `Expected date: ${newInflow.expected_date}. ` : ""}
                    {newInflow.recurrence ? `Recurrence: ${newInflow.recurrence}. ` : ""}
                    {newInflow.category_id ? "Category mapped. " : ""}
                    {newInflow.counterparty_id ? "Counterparty mapped." : ""}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleAddInflow}
                    disabled={!newInflow.source.trim() || !newInflow.expected_amount}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                             disabled:opacity-50 disabled:cursor-not-allowed rounded-md
                             transition-colors duration-150 ease-in-out"
                  >
                    Add Inflow
                  </button>
                  <button
                    onClick={handleCancelAdd}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                             hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md
                             transition-colors duration-150 ease-in-out"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
