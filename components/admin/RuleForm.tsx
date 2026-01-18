"use client";

import { useState } from "react";
import type { Category } from "@/types/database";

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
  const updateField = <K extends keyof RuleFormData>(field: K, value: RuleFormData[K]) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
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
