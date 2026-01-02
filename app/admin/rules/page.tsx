"use client";

import { useState, useEffect, useCallback } from "react";
import { RuleForm, emptyFormData, type RuleFormData } from "@/components/admin/RuleForm";
import type { CategorizationRuleWithCategory, Category } from "@/types/database";

export default function RulesAdminPage() {
  const [rules, setRules] = useState<CategorizationRuleWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
