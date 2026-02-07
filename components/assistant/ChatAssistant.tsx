"use client";

import { useMemo, useState } from "react";
import type { ParsedRulePayload } from "@/lib/assistant/types";
import { RulePreviewCard } from "./RulePreviewCard";
import type { TransactionWithDetails } from "@/types/database";

interface ChatAssistantProps {
  selectedTransaction?: TransactionWithDetails | null;
}

interface AssistantResponse {
  rule?: ParsedRulePayload;
  clarification?: string;
  response?: string;
  error?: string;
}

export function ChatAssistant({ selectedTransaction }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewRule, setPreviewRule] = useState<ParsedRulePayload | null>(null);
  const [message, setMessage] = useState<string>("");

  const contextHint = useMemo(() => {
    if (!selectedTransaction) return "No transaction selected.";
    return `Selected: ${selectedTransaction.description_clean || selectedTransaction.description_raw} (${selectedTransaction.amount})`;
  }, [selectedTransaction]);

  const send = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setPreviewRule(null);
    setMessage("");

    try {
      const response = await fetch("/api/assistant/parse-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, selectedTransaction }),
      });

      const payload: AssistantResponse = await response.json();
      if (payload.rule) {
        setPreviewRule(payload.rule);
        setMessage("Review the rule and confirm to save.");
      } else {
        setMessage(payload.clarification || payload.response || payload.error || "Could not parse request.");
      }
    } catch {
      setMessage("Failed to reach assistant parser.");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!previewRule?.assign_category_id) return;
    setLoading(true);
    try {
      const response = await fetch("/api/categorization/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...previewRule,
          assign_category_id: previewRule.assign_category_id,
        }),
      });

      if (response.ok) {
        setMessage("Rule saved.");
        setPreviewRule(null);
      } else {
        const payload = await response.json();
        setMessage(payload.error || "Failed to save rule.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-blue-600 text-white px-4 py-3 text-sm shadow-lg min-h-[44px]"
      >
        Assistant
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="font-semibold">Rule Assistant</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{contextHint}</div>
          </div>

          <div className="p-4 space-y-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder='Example: Categorize Starbucks under $15 as Coffee'
              className="w-full min-h-[96px] rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={send}
                disabled={loading}
                className="btn-primary text-sm min-h-[44px]"
              >
                {loading ? "Parsing..." : "Parse"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewRule(null);
                  setMessage("Cancelled.");
                }}
                className="btn-secondary text-sm min-h-[44px]"
              >
                Cancel
              </button>
            </div>

            {message && <div className="text-xs text-slate-600 dark:text-slate-300">{message}</div>}

            {previewRule && (
              <div className="space-y-2">
                <RulePreviewCard rule={previewRule} />
                <button
                  type="button"
                  className="btn-primary text-sm min-h-[44px]"
                  onClick={confirm}
                  disabled={loading || !previewRule.assign_category_id}
                >
                  Confirm Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
