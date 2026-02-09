"use client";

import { useEffect, useState } from "react";
import type { Account } from "@/types/database";
import type { AssistantAction, AssistantChatDebugInfo, AssistantChatResult } from "@/lib/assistant/types";

interface EditState {
  [id: string]: AccountEdit;
}

interface AccountEdit {
  display_name: string;
  owner: string;
  subtype: string;
}

const OWNER_OPTIONS = ["Brett", "Ashley", "Joint"] as const;
const TYPE_OPTIONS = [
  "checking",
  "savings",
  "credit_card",
  "loan",
  "mortgage",
  "investment",
  "hsa",
  "money_market",
  "other",
] as const;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [edits, setEdits] = useState<EditState>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [suggestionPreview, setSuggestionPreview] = useState<AssistantAction<"suggest_account_updates"> | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [assistantHistory, setAssistantHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<Array<{
    id: string;
    request: unknown;
    response: unknown;
    debug: AssistantChatDebugInfo | undefined;
  }>>([]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data.accounts || []);
        const initial: EditState = {};
        (data.accounts || []).forEach((account: Account) => {
          initial[account.id] = getAccountDefaults(account);
        });
        setEdits(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  const getAccountDefaults = (account: Account): AccountEdit => ({
    display_name: account.display_name || account.name,
    owner: account.owner || "Joint",
    subtype: account.subtype || "other",
  });

  const updateEdit = (account: Account, patch: Partial<AccountEdit>) => {
    setEdits((prev) => ({
      ...prev,
      [account.id]: {
        ...(prev[account.id] || getAccountDefaults(account)),
        ...patch,
      },
    }));
  };

  const saveAccount = async (accountId: string) => {
    const next = edits[accountId];
    if (!next) return;

    const nextLabel = next.display_name.trim();
    const nextOwner = next.owner.trim();
    const nextType = next.subtype.trim();
    if (!nextLabel || !nextOwner || !nextType) return;

    setSavingId(accountId);
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: nextLabel,
        owner: nextOwner,
        subtype: nextType,
      }),
    });

    if (res.ok) {
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === accountId
            ? { ...account, display_name: nextLabel, owner: nextOwner as Account["owner"], subtype: nextType }
            : account
        )
      );
    }

    setSavingId(null);
  };

  const generateSuggestions = async () => {
    const prompt = assistantPrompt.trim();
    if (!prompt || assistantLoading) return;

    setAssistantLoading(true);
    setAssistantMessage(null);
    setSuggestionPreview(null);
    setSelectedSuggestionIds(new Set());

    try {
      const nextMessages = [...assistantHistory, { role: "user" as const, content: prompt }];
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionHint: "suggest_account_updates",
          messages: nextMessages,
          debug: debugEnabled,
        }),
      });
      const payload = (await response.json()) as AssistantChatResult & { error?: string };
      const assistantReply = payload.assistant_message || payload.error || "No suggestions returned.";
      setAssistantMessage(assistantReply);
      setAssistantHistory((prev) => [...prev, { role: "user", content: prompt }, { role: "assistant", content: assistantReply }]);
      if (debugEnabled) {
        setDebugEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            request: {
              actionHint: "suggest_account_updates",
              messages: nextMessages,
              debug: true,
            },
            response: payload,
            debug: payload.debug,
          },
        ]);
      }
      if (payload.action?.type === "suggest_account_updates") {
        const action = payload.action as AssistantAction<"suggest_account_updates">;
        setSuggestionPreview(action);
        setSelectedSuggestionIds(new Set(action.preview.suggestions.map((row) => row.account_id)));
      }
    } catch {
      setAssistantMessage("Failed to generate account suggestions.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const applySuggestions = async (mode: "selected" | "all") => {
    if (!suggestionPreview) return;
    const targetIds = mode === "all"
      ? new Set(suggestionPreview.preview.suggestions.map((row) => row.account_id))
      : selectedSuggestionIds;

    const targetRows = suggestionPreview.preview.suggestions.filter((row) => targetIds.has(row.account_id));
    if (targetRows.length === 0) return;

    setAssistantLoading(true);
    setAssistantMessage(null);

    try {
      for (const row of targetRows) {
        await fetch(`/api/accounts/${row.account_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: row.suggested_display_name,
            owner: row.suggested_owner,
          }),
        });
      }

      setAccounts((prev) =>
        prev.map((account) => {
          const suggestion = targetRows.find((row) => row.account_id === account.id);
          if (!suggestion) return account;
          return {
            ...account,
            display_name: suggestion.suggested_display_name,
            owner: suggestion.suggested_owner as Account["owner"],
          };
        })
      );
      setEdits((prev) => {
        const next = { ...prev };
        for (const row of targetRows) {
          const current = next[row.account_id];
          if (!current) continue;
          next[row.account_id] = {
            ...current,
            display_name: row.suggested_display_name,
            owner: row.suggested_owner,
          };
        }
        return next;
      });

      setAssistantMessage(`Applied ${targetRows.length} account suggestion${targetRows.length === 1 ? "" : "s"}.`);
      setSuggestionPreview((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          preview: {
            suggestions: prev.preview.suggestions.filter((row) => !targetIds.has(row.account_id)),
          },
        };
      });
      setSelectedSuggestionIds(new Set());
    } catch {
      setAssistantMessage("Failed to apply one or more account suggestions.");
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading) {
    return <div className="card p-6 text-slate-500">Loading accounts...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accounts</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Connected accounts and display label management
        </p>
      </div>

      <div className="card p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Assistant Suggestions</div>
          <button
            type="button"
            className={`text-xs px-2 py-1 rounded-md border ${
              debugEnabled
                ? "border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20"
                : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
            onClick={() => setDebugEnabled((prev) => !prev)}
          >
            Debug {debugEnabled ? "On" : "Off"}
          </button>
        </div>
        <div className="flex gap-2">
          <input
            className="input min-h-[44px]"
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
            placeholder="e.g., normalize account labels and set owner Joint"
          />
          <button
            onClick={generateSuggestions}
            disabled={assistantLoading || !assistantPrompt.trim()}
            className="btn-primary text-xs min-h-[44px]"
          >
            {assistantLoading ? "Parsing..." : "Preview"}
          </button>
        </div>
        {assistantMessage && <div className="text-xs text-slate-600 dark:text-slate-300">{assistantMessage}</div>}
        {suggestionPreview && suggestionPreview.preview.suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="max-h-52 overflow-y-auto rounded border border-slate-200 dark:border-slate-700">
              {suggestionPreview.preview.suggestions.map((row) => (
                <label
                  key={row.account_id}
                  className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedSuggestionIds.has(row.account_id)}
                    onChange={(event) => {
                      setSelectedSuggestionIds((prev) => {
                        const next = new Set(prev);
                        if (event.target.checked) next.add(row.account_id);
                        else next.delete(row.account_id);
                        return next;
                      });
                    }}
                  />
                  <span className="flex-1">{row.provider_name}</span>
                  <span>{row.current_display_name} → {row.suggested_display_name}</span>
                  <span>{row.current_owner} → {row.suggested_owner}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => applySuggestions("selected")}
                disabled={assistantLoading || selectedSuggestionIds.size === 0}
                className="btn-primary text-xs min-h-[44px]"
              >
                Apply Selected
              </button>
              <button
                onClick={() => applySuggestions("all")}
                disabled={assistantLoading || suggestionPreview.preview.suggestions.length === 0}
                className="btn-secondary text-xs min-h-[44px]"
              >
                Apply All
              </button>
            </div>
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

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Institution</th>
              <th className="px-4 py-3 text-left">Provider Name</th>
              <th className="px-4 py-3 text-left">Display Label</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const defaults = getAccountDefaults(account);
              const edit = edits[account.id] || defaults;
              const hasChanges =
                edit.display_name.trim() !== defaults.display_name.trim() ||
                edit.owner !== defaults.owner ||
                edit.subtype !== defaults.subtype;
              const hasValidValues =
                edit.display_name.trim().length > 0 &&
                edit.owner.trim().length > 0 &&
                edit.subtype.trim().length > 0;
              const isSaving = savingId === account.id;
              const canSave = hasChanges && hasValidValues && !isSaving;

              return (
                <tr key={account.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-3">{account.institution_name || "Unknown"}</td>
                <td className="px-4 py-3">{account.name}</td>
                <td className="px-4 py-3">
                  <input
                    className="input min-h-[44px]"
                    value={edit.display_name}
                    onChange={(e) => updateEdit(account, { display_name: e.target.value })}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    className="input min-h-[44px]"
                    value={edit.owner}
                    onChange={(e) => updateEdit(account, { owner: e.target.value })}
                  >
                    {OWNER_OPTIONS.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="input min-h-[44px]"
                    value={edit.subtype}
                    onChange={(e) => updateEdit(account, { subtype: e.target.value })}
                  >
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className={
                      canSave
                        ? "btn-primary text-xs min-h-[44px]"
                        : "text-xs min-h-[44px] px-4 py-2 rounded-lg font-medium bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed"
                    }
                    onClick={() => saveAccount(account.id)}
                    disabled={!canSave}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
