"use client";

import { useState } from "react";
import type { Category } from "@/types/database";
import type { AssistantChatDebugInfo, AssistantChatResult, ParsedRulePayload } from "@/lib/assistant/types";

// Info tooltips for each field
const FIELD_INFO: Record<string, string> = {
  name: "A short, descriptive name for this rule (e.g., 'Grocery Stores', 'Netflix Subscription'). This helps you identify the rule later.",
  priority: "Higher priority rules run first (1-100). If multiple rules could match a transaction, the highest priority rule wins. Default is 50.",
  description: "Optional notes about when/why this rule should apply. Helpful for remembering the purpose later.",
  match_merchant_contains: "Match transactions where the merchant name CONTAINS this text (case-insensitive). Example: 'STARBUCKS' matches 'STARBUCKS #1234' and 'STARBUCKS COFFEE'.",
  match_merchant_exact: "Match transactions where the description EXACTLY matches this text. Use for very specific matching when 'contains' is too broad.",
  match_amount_min: "Only match transactions with an amount >= this value. Leave empty to ignore. Use absolute values (e.g., 50 for $50).",
  match_amount_max: "Only match transactions with an amount <= this value. Leave empty to ignore. Use absolute values (e.g., 100 for $100).",
  match_direction: "Filter by money direction: 'Inflow' for income/deposits, 'Outflow' for expenses/payments, or 'Any' to match both.",
  assign_category_id: "The category to assign when this rule matches. This is required - every rule must assign a category.",
  assign_is_transfer: "Mark matched transactions as transfers (e.g., moving money between your own accounts). Transfers are excluded from income/expense totals.",
  assign_is_pass_through: "Mark as pass-through (e.g., T-Mobile reimbursements). Pass-through transactions are netted out in cashflow calculations.",
  is_active: "Toggle to enable/disable this rule. Inactive rules are saved but won't be applied to transactions.",
};

// Info icon component with tooltip
function InfoIcon({ fieldKey }: { fieldKey: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const info = FIELD_INFO[fieldKey];
  if (!info) return null;

  return (
    <span 
      className="relative inline-block ml-1 cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-slate-400 hover:text-blue-500 text-sm">ⓘ</span>
      {showTooltip && (
        <div className="absolute z-50 w-64 p-2 text-xs font-normal normal-case tracking-normal text-left text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg -left-2 top-6">
          {info}
        </div>
      )}
    </span>
  );
}

export interface RuleFormData {
  name: string;
  description: string;
  priority: number;
  is_active: boolean;
  match_merchant_contains: string;
  match_merchant_exact: string;
  match_amount_min: string;
  match_amount_max: string;
  match_direction: "" | "inflow" | "outflow";
  assign_category_id: string;
  assign_is_transfer: boolean;
  assign_is_pass_through: boolean;
}

export const emptyFormData: RuleFormData = {
  name: "",
  description: "",
  priority: 50,
  is_active: true,
  match_merchant_contains: "",
  match_merchant_exact: "",
  match_amount_min: "",
  match_amount_max: "",
  match_direction: "",
  assign_category_id: "",
  assign_is_transfer: false,
  assign_is_pass_through: false,
};

interface RuleFormProps {
  formData: RuleFormData;
  setFormData: (data: RuleFormData) => void;
  categories: Category[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
}

export function RuleForm({
  formData,
  setFormData,
  categories,
  onSave,
  onCancel,
  saving,
  isEditing,
}: RuleFormProps) {
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugEntries, setDebugEntries] = useState<Array<{
    id: string;
    request: unknown;
    response: unknown;
    debug: AssistantChatDebugInfo | undefined;
  }>>([]);

  const updateField = <K extends keyof RuleFormData>(field: K, value: RuleFormData[K]) => {
    setFormData({ ...formData, [field]: value });
  };

  const applyRuleToForm = (rule: ParsedRulePayload) => {
    setFormData({
      name: rule.name || formData.name,
      description: rule.description || "",
      priority: rule.priority ?? 50,
      is_active: rule.is_active ?? true,
      match_merchant_contains: rule.match_merchant_contains || "",
      match_merchant_exact: rule.match_merchant_exact || "",
      match_amount_min: rule.match_amount_min != null ? String(rule.match_amount_min) : "",
      match_amount_max: rule.match_amount_max != null ? String(rule.match_amount_max) : "",
      match_direction: rule.match_direction || "",
      assign_category_id: rule.assign_category_id || "",
      assign_is_transfer: rule.assign_is_transfer === true,
      assign_is_pass_through: rule.assign_is_pass_through === true,
    });
  };

  const handleGenerateFromPrompt = async () => {
    const prompt = assistantPrompt.trim();
    if (!prompt || assistantLoading) return;

    setAssistantLoading(true);
    setAssistantMessage(null);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionHint: "create_rule",
          messages: [{ role: "user", content: prompt }],
          debug: debugEnabled,
        }),
      });
      const payload = (await response.json()) as AssistantChatResult & { error?: string };
      const parsedRule =
        payload.rule ||
        (payload.action?.type === "create_rule" ? payload.action.preview : null);

      if (parsedRule) {
        applyRuleToForm(parsedRule as ParsedRulePayload);
      }
      if (debugEnabled) {
        setDebugEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            request: {
              actionHint: "create_rule",
              messages: [{ role: "user", content: prompt }],
              debug: true,
            },
            response: payload,
            debug: payload.debug,
          },
        ]);
      }
      setAssistantMessage(payload.assistant_message || payload.clarification || payload.error || "No suggestion returned.");
    } catch {
      setAssistantMessage("Failed to generate rule from prompt.");
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-900/10 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-blue-900 dark:text-blue-200">Generate From Prompt</div>
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
            onChange={(e) => setAssistantPrompt(e.target.value)}
            className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            placeholder="e.g., Categorize Starbucks under $20 outflow as Coffee"
          />
          <button
            type="button"
            onClick={handleGenerateFromPrompt}
            disabled={assistantLoading || !assistantPrompt.trim()}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {assistantLoading ? "Generating..." : "Generate"}
          </button>
        </div>
        {assistantMessage && (
          <div className="text-xs text-blue-700 dark:text-blue-300">{assistantMessage}</div>
        )}
        {debugEnabled && (
          <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/10 p-2 space-y-2">
            <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Debug trace (latest first)</div>
            {debugEntries.length === 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-400">Run Generate to capture request/response.</div>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Rule Name *<InfoIcon fieldKey="name" />
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            placeholder="e.g., Grocery Stores"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Priority (higher = runs first)<InfoIcon fieldKey="priority" />
          </label>
          <input
            type="number"
            value={formData.priority}
            onChange={(e) => updateField("priority", parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Description<InfoIcon fieldKey="description" />
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          placeholder="Optional description"
        />
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Match Conditions</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Merchant Contains<InfoIcon fieldKey="match_merchant_contains" />
            </label>
            <input
              type="text"
              value={formData.match_merchant_contains}
              onChange={(e) => updateField("match_merchant_contains", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="e.g., STARBUCKS"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Merchant Exact Match<InfoIcon fieldKey="match_merchant_exact" />
            </label>
            <input
              type="text"
              value={formData.match_merchant_exact}
              onChange={(e) => updateField("match_merchant_exact", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Exact description match"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount Min ($)<InfoIcon fieldKey="match_amount_min" />
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.match_amount_min}
              onChange={(e) => updateField("match_amount_min", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount Max ($)<InfoIcon fieldKey="match_amount_max" />
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.match_amount_max}
              onChange={(e) => updateField("match_amount_max", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Direction<InfoIcon fieldKey="match_direction" />
            </label>
            <select
              value={formData.match_direction}
              onChange={(e) => updateField("match_direction", e.target.value as "" | "inflow" | "outflow")}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">Any</option>
              <option value="inflow">Inflow (Income)</option>
              <option value="outflow">Outflow (Expense)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Assign Values</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category *<InfoIcon fieldKey="assign_category_id" />
            </label>
            <select
              value={formData.assign_category_id}
              onChange={(e) => updateField("assign_category_id", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.cashflow_group})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.assign_is_transfer}
                onChange={(e) => updateField("assign_is_transfer", e.target.checked)}
                className="rounded"
              />
              Mark as Transfer
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.assign_is_pass_through}
                onChange={(e) => updateField("assign_is_pass_through", e.target.checked)}
                className="rounded"
              />
              Mark as Pass-Through
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => updateField("is_active", e.target.checked)}
            className="rounded"
          />
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onCancel}
          type="button"
          className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          type="button"
          disabled={saving || !formData.name || !formData.assign_category_id}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : isEditing ? "Update Rule" : "Create Rule"}
        </button>
      </div>
    </div>
  );
}
