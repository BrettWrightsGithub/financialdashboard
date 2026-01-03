"use client";

import { useState, useEffect, useCallback } from "react";
import { RuleForm, emptyFormData, type RuleFormData } from "@/components/admin/RuleForm";
import type { CategorizationRuleWithCategory, Category } from "@/types/database";

interface PreviewResult {
  ruleId: string;
  ruleName: string;
  matchingTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    currentCategory: string | null;
    newCategory: string;
    isLocked: boolean;
  }>;
  totalMatching: number;
  wouldChange: number;
  wouldSkipLocked: number;
}

export default function RulesAdminPage() {
  const [rules, setRules] = useState<CategorizationRuleWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  
  // Dry run preview state
  const [previewingRule, setPreviewingRule] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/categorization/rules");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRules(data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rules");
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      // Categories endpoint may not exist yet, use empty array
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchRules(), fetchCategories()]).finally(() => setLoading(false));
  }, [fetchRules, fetchCategories]);

  const handleEdit = (rule: CategorizationRuleWithCategory) => {
    setEditingRule(rule.id);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      priority: rule.priority,
      is_active: rule.is_active,
      match_merchant_contains: rule.match_merchant_contains || "",
      match_merchant_exact: rule.match_merchant_exact || "",
      match_amount_min: rule.match_amount_min?.toString() || "",
      match_amount_max: rule.match_amount_max?.toString() || "",
      match_direction: rule.match_direction || "",
      assign_category_id: rule.assign_category_id,
      assign_is_transfer: rule.assign_is_transfer || false,
      assign_is_pass_through: rule.assign_is_pass_through || false,
    });
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setEditingRule(null);
    setFormData(emptyFormData);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setEditingRule(null);
    setShowAddForm(false);
    setFormData(emptyFormData);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        match_amount_min: formData.match_amount_min ? parseFloat(formData.match_amount_min) : null,
        match_amount_max: formData.match_amount_max ? parseFloat(formData.match_amount_max) : null,
        match_direction: formData.match_direction || null,
        match_merchant_contains: formData.match_merchant_contains || null,
        match_merchant_exact: formData.match_merchant_exact || null,
      };

      if (editingRule) {
        // Update existing rule
        const res = await fetch("/api/categorization/rules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRule, ...payload }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      } else {
        // Create new rule
        const res = await fetch("/api/categorization/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }

      await fetchRules();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const res = await fetch(`/api/categorization/rules?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleToggleActive = async (rule: CategorizationRuleWithCategory) => {
    try {
      const res = await fetch("/api/categorization/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle rule");
    }
  };

  // Dry run preview with guardrails
  const handlePreview = async (ruleId: string) => {
    // Close any existing preview first
    if (previewingRule === ruleId) {
      setPreviewingRule(null);
      setPreviewResult(null);
      return;
    }

    setPreviewingRule(ruleId);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewResult(null);

    try {
      // Use last 90 days as default range for safety
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const res = await fetch("/api/rules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: ruleId,
          date_range: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreviewResult(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Categorization Rules
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Rules are evaluated in priority order (highest first). First matching rule wins.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Rule
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Add New Rule</h2>
          <RuleForm
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            onSave={handleSave}
            onCancel={handleCancel}
            saving={saving}
            isEditing={false}
          />
        </div>
      )}

      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">No rules configured yet.</p>
            <button
              onClick={handleAdd}
              className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create your first rule
            </button>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 bg-white dark:bg-slate-800 rounded-lg border ${
                rule.is_active
                  ? "border-slate-200 dark:border-slate-700"
                  : "border-slate-200 dark:border-slate-700 opacity-60"
              }`}
            >
              {editingRule === rule.id ? (
                <RuleForm
                  formData={formData}
                  setFormData={setFormData}
                  categories={categories}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  saving={saving}
                  isEditing={true}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono rounded">
                        P{rule.priority}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {rule.name}
                      </h3>
                      {!rule.is_active && (
                        <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        {rule.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {rule.match_merchant_contains && (
                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          Contains: {rule.match_merchant_contains}
                        </span>
                      )}
                      {rule.match_merchant_exact && (
                        <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                          Exact: {rule.match_merchant_exact}
                        </span>
                      )}
                      {(rule.match_amount_min || rule.match_amount_max) && (
                        <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          Amount: ${rule.match_amount_min || "0"} - ${rule.match_amount_max || "∞"}
                        </span>
                      )}
                      {rule.match_direction && (
                        <span className="px-2 py-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                          {rule.match_direction === "inflow" ? "↓ Inflow" : "↑ Outflow"}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                        → {rule.category_name}
                      </span>
                      {rule.assign_is_transfer && (
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                          Transfer
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handlePreview(rule.id)}
                      disabled={previewLoading && previewingRule === rule.id}
                      className={`p-2 rounded-lg transition-colors ${
                        previewingRule === rule.id
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      }`}
                      title="Preview (Dry Run)"
                    >
                      {previewLoading && previewingRule === rule.id ? "⏳" : "👁"}
                    </button>
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className={`p-2 rounded-lg transition-colors ${
                        rule.is_active
                          ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title={rule.is_active ? "Deactivate" : "Activate"}
                    >
                      {rule.is_active ? "●" : "○"}
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              
              {/* Preview Results Panel */}
              {previewingRule === rule.id && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  {previewLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Running dry run preview (last 90 days)...
                    </div>
                  ) : previewError ? (
                    <div className="text-red-600 dark:text-red-400 text-sm">
                      Error: {previewError}
                    </div>
                  ) : previewResult ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Dry Run Results (last 90 days)
                        </span>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {previewResult.totalMatching} matches
                        </span>
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          {previewResult.wouldChange} would change
                        </span>
                        {previewResult.wouldSkipLocked > 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                            {previewResult.wouldSkipLocked} locked (skipped)
                          </span>
                        )}
                      </div>
                      
                      {previewResult.matchingTransactions.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Date</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Description</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Amount</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Current</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">New</th>
                                <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-400">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {previewResult.matchingTransactions.slice(0, 50).map((tx) => (
                                <tr key={tx.id} className={tx.isLocked ? "opacity-50" : ""}>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {new Date(tx.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-2 text-slate-900 dark:text-white max-w-[200px] truncate">
                                    {tx.description}
                                  </td>
                                  <td className={`px-3 py-2 text-right whitespace-nowrap ${
                                    tx.amount >= 0 ? "text-green-600" : "text-slate-900 dark:text-white"
                                  }`}>
                                    ${Math.abs(tx.amount).toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                    {tx.currentCategory || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-medium">
                                    {tx.newCategory}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {tx.isLocked ? (
                                      <span className="text-amber-600" title="Locked - will be skipped">🔒</span>
                                    ) : tx.currentCategory === tx.newCategory ? (
                                      <span className="text-slate-400" title="Already correct">—</span>
                                    ) : (
                                      <span className="text-green-600" title="Will change">✓</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {previewResult.matchingTransactions.length > 50 && (
                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                              Showing 50 of {previewResult.matchingTransactions.length} matches
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400 py-2">
                          No matching transactions found in the last 90 days.
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => { setPreviewingRule(null); setPreviewResult(null); }}
                          className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                        >
                          Close Preview
                        </button>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          This is a dry run — no changes have been made
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
