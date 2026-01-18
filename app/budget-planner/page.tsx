"use client";

import { useState, useEffect } from "react";
import { BudgetTable } from "@/components/budget/BudgetTable";
import { MonthSelector } from "@/components/budget/MonthSelector";
import { BudgetAllocationBar } from "@/components/budget/BudgetAllocationBar";
import { ExpectedInflowsSection } from "@/components/budget/ExpectedInflowsSection";
import { CopyForwardModal, EmptyStateCopyForward } from "@/components/budget/CopyForwardModal";
import { getCategories, getBudgetTargets, getMostRecentBudgetMonth, copyBudgetForward, upsertBudgetTarget } from "@/lib/queries";
import type { Category } from "@/types/database";

export default function BudgetPlannerPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetTargets, setBudgetTargets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [sourceMonth, setSourceMonth] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [categoriesData, targetsData] = await Promise.all([
        getCategories(),
        getBudgetTargets(selectedMonth)
      ]);
      
      setCategories(categoriesData);
      setBudgetTargets(targetsData);

      // Check if we should show copy-forward modal
      if (targetsData.length === 0) {
        const recentMonth = await getMostRecentBudgetMonth();
        if (recentMonth && recentMonth !== selectedMonth) {
          setSourceMonth(recentMonth);
          setShowCopyModal(true);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyForward = async (includeInflows: boolean) => {
    if (!sourceMonth) return;
    
    setIsCopying(true);
    try {
      await copyBudgetForward(sourceMonth, selectedMonth, includeInflows);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error("Error copying budget forward:", error);
    } finally {
      setIsCopying(false);
    }
  };

  const handleCategoryAdd = async (category: Category) => {
    try {
      await upsertBudgetTarget(category.id, selectedMonth, 0);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleResetToActuals = async () => {
    if (!confirm("Are you sure you want to reset all budget targets to last month's actual spending?")) {
      return;
    }

    try {
      // Get last month's actuals and update each budget target
      const response = await fetch(`/api/budget-targets?month=${selectedMonth}`);
      const { data } = await response.json();
      
      // For each target, we'd need to fetch last month's actuals and update
      // This is a simplified version - in production you might want a dedicated API endpoint
      alert("Reset to actuals functionality would be implemented here with a dedicated API endpoint");
    } catch (error) {
      console.error("Error resetting to actuals:", error);
    }
  };

  // Calculate totals for allocation bar
  const incomeTotal = budgetTargets
    .filter(t => categories.find(c => c.id === t.category_id)?.cashflow_group === "Income")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
  const allocatedTotal = budgetTargets
    .filter(t => categories.find(c => c.id === t.category_id)?.cashflow_group !== "Income")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Budget Planner</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Plan and track your monthly budget with inline editing
          </p>
        </div>
        <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Budget Allocation Bar */}
      <BudgetAllocationBar 
        totalIncome={incomeTotal}
        totalAllocated={allocatedTotal}
      />

      {/* Expected Inflows Section */}
      <ExpectedInflowsSection month={selectedMonth} />

      {/* Budget Targets Section */}
      {budgetTargets.length === 0 && !showCopyModal ? (
        <EmptyStateCopyForward
          onCopyForward={handleCopyForward}
          isLoading={isCopying}
        />
      ) : (
        <BudgetTable 
          month={selectedMonth}
          categories={categories}
          onCategoryAdd={handleCategoryAdd}
          onResetToActuals={handleResetToActuals}
        />
      )}

      {/* Copy Forward Modal */}
      {showCopyModal && sourceMonth && (
        <CopyForwardModal
          isOpen={showCopyModal}
          onClose={() => setShowCopyModal(false)}
          sourceMonth={sourceMonth}
          destMonth={selectedMonth}
          onCopyForward={handleCopyForward}
          isLoading={isCopying}
        />
      )}
    </div>
  );
}
