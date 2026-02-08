"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  AssistantChatDebugInfo,
  AssistantChatMessage,
  AssistantChatResult,
  ParsedRulePayload,
} from "@/lib/assistant/types";
import { RulePreviewCard } from "./RulePreviewCard";
import type { TransactionWithDetails } from "@/types/database";

interface ChatAssistantProps {
  selectedTransaction?: TransactionWithDetails | null;
  title?: string;
  placeholder?: string;
  quickPrompts?: string[];
}

interface AssistantMessage extends AssistantChatMessage {
  id: string;
}

interface AssistantResponse extends Partial<AssistantChatResult> {
  error?: string;
}

interface DebugEntry {
  id: string;
  request: {
    messages: AssistantChatMessage[];
    selectedTransaction: TransactionWithDetails | null | undefined;
    draftRule: ParsedRulePayload | null;
    debug: boolean;
  };
  response: AssistantResponse;
  debug: AssistantChatDebugInfo | undefined;
}

function createMessage(role: "assistant" | "user", content: string): AssistantMessage {
  return {
    id: `${Date.now()}-${Math.random()}`,
    role,
    content,
  };
}

const INITIAL_MESSAGE = createMessage("assistant", "How can I help?");

export function ChatAssistant({
  selectedTransaction,
  title = "Rule Assistant",
  placeholder = "Describe what rule you want to create...",
  quickPrompts = [
    "Create a Starbucks under $20 outflow rule for Coffee",
    "Mark Venmo transfers as transfer",
    "Create a rule for payroll inflows as Income",
  ],
}: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([INITIAL_MESSAGE]);
  const [previewRule, setPreviewRule] = useState<ParsedRulePayload | null>(null);
  const [createdRule, setCreatedRule] = useState<{ id: string; name: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const contextHint = useMemo(() => {
    if (!selectedTransaction) return "No transaction selected.";
    return `Selected: ${selectedTransaction.description_clean || selectedTransaction.description_raw} (${selectedTransaction.amount})`;
  }, [selectedTransaction]);

  const confirmRule = async () => {
    if (!previewRule?.assign_category_id) return;
    setConfirming(true);

    try {
      const response = await fetch("/api/categorization/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewRule),
      });

      if (response.ok) {
        const payload = await response.json();
        setCreatedRule({
          id: payload.rule?.id || "",
          name: payload.rule?.name || previewRule.name,
        });
        setPreviewRule(null);
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", "Looks good. I added that rule."),
        ]);
      } else {
        const payload = await response.json();
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", payload.error || "Failed to save rule."),
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Failed to save rule."),
      ]);
    } finally {
      setConfirming(false);
    }
  };

  const send = async () => {
    if (!input.trim() || loading || confirming) return;

    const userMessage = createMessage("user", input.trim());
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setCreatedRule(null);

    try {
      const requestBody = {
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        selectedTransaction,
        draftRule: previewRule,
        debug: debugEnabled,
      };
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const payload: AssistantResponse = await response.json();
      const text = payload.assistant_message || payload.error || "I couldn't process that. Please try again.";
      setMessages((prev) => [...prev, createMessage("assistant", text)]);
      const nextRule =
        payload.rule ||
        (payload.action?.type === "create_rule" && payload.action.preview
          ? (payload.action.preview as ParsedRulePayload)
          : null);
      setPreviewRule(nextRule);
      if (debugEnabled) {
        setDebugEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            request: requestBody,
            response: payload,
            debug: payload.debug,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "I couldn't reach the assistant service."),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setPreviewRule(null);
    setCreatedRule(null);
    setInput("");
    setDebugEntries([]);
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
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{title}</div>
              <button
                type="button"
                className={`text-xs px-2 py-1 rounded-md border ${
                  debugEnabled
                    ? "border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                }`}
                onClick={() => setDebugEnabled((prev) => !prev)}
              >
                Debug {debugEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{contextHint}</div>
          </div>

          <div className="p-4 space-y-3">
            {quickPrompts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    message.role === "assistant"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      : "bg-blue-600 text-white ml-8"
                  }`}
                >
                  {message.content}
                </div>
              ))}
            </div>

            {debugEnabled && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/10 p-2 space-y-2">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Debug trace (latest first)
                </div>
                {debugEntries.length === 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    Send a message to capture prompt and model call details.
                  </div>
                )}
                {debugEntries.slice(-3).reverse().map((entry) => (
                  <div key={entry.id} className="rounded border border-amber-200 dark:border-amber-800 p-2 space-y-1 bg-white/70 dark:bg-slate-900/40">
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      Prompt: {entry.debug?.contextual_prompt || "N/A"}
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      LLM: {entry.debug?.llm_call?.provider || "N/A"} • {entry.debug?.llm_call?.model || "N/A"} • status {entry.debug?.llm_call?.status ?? "N/A"}
                    </div>
                    {entry.debug?.llm_call?.error && (
                      <div className="text-[11px] text-red-700 dark:text-red-300">
                        Error: {entry.debug.llm_call.error}
                      </div>
                    )}
                    <details>
                      <summary className="text-[11px] cursor-pointer text-amber-700 dark:text-amber-300">Request/response JSON</summary>
                      <pre className="mt-1 max-h-40 overflow-auto text-[10px] whitespace-pre-wrap break-all">
                        {JSON.stringify({ request: entry.request, response: entry.response, debug: entry.debug }, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}

            {previewRule && (
              <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                <RulePreviewCard rule={previewRule} />
                {!previewRule.assign_category_id && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    Category needs clarification before confirming.
                  </div>
                )}
                <button
                  type="button"
                  className="btn-primary text-sm min-h-[44px] w-full"
                  onClick={confirmRule}
                  disabled={loading || confirming || !previewRule.assign_category_id}
                >
                  {confirming ? "Saving..." : "Confirm"}
                </button>
              </div>
            )}

            {createdRule && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                <div className="font-medium">✓ Rule added.</div>
                <Link className="underline" href={`/admin/rules?highlight=${createdRule.id}`}>
                  Check it out here
                </Link>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder={placeholder}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm min-h-[44px]"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || confirming || !input.trim()}
                className="btn-primary text-sm min-h-[44px]"
              >
                {loading ? "..." : "Send"}
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="btn-secondary text-sm min-h-[44px]"
              >
                New
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
