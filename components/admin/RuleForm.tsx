"use client";

import type { Category } from "@/types/database";

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
            Rule Name *
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
            Priority (higher = runs first)
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
          Description
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
              Merchant Contains
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
              Merchant Exact Match
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
              Amount Min ($)
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
              Amount Max ($)
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
              Direction
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
              Category *
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
