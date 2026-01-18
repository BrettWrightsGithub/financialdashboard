"use client";

import { useState, useEffect, useRef } from "react";
import { getCategories } from "@/lib/queries";
import type { Category } from "@/types/database";

interface AddCategoryDropdownProps {
  month: string;
  existingCategoryIds: string[];
  onCategoryAdd: (category: Category) => Promise<void>;
  className?: string;
}

export function AddCategoryDropdown({
  month,
  existingCategoryIds,
  onCategoryAdd,
  className = "",
}: AddCategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch categories when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const allCategories = await getCategories();
      setCategories(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter categories that aren't already in the budget
  const availableCategories = categories.filter(
    (category) => !existingCategoryIds.includes(category.id)
  );

  // Filter by search query
  const filteredCategories = availableCategories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.cashflow_group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by cashflow group
  const groupedCategories = filteredCategories.reduce((acc, category) => {
    if (!acc[category.cashflow_group]) {
      acc[category.cashflow_group] = [];
    }
    acc[category.cashflow_group].push(category);
    return acc;
  }, {} as Record<string, Category[]>);

  const handleCategorySelect = async (category: Category) => {
    setIsAdding(true);
    try {
      await onCategoryAdd(category);
      setIsOpen(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Error adding category:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={handleToggle}
        disabled={isAdding}
        className={`
          px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
          disabled:opacity-50 disabled:cursor-not-allowed
          rounded-lg transition-colors duration-150 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-slate-900
        `}
      >
        {isAdding ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Adding...
          </span>
        ) : (
          "Add Category"
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Categories List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading categories...
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                {searchQuery ? "No categories found matching your search." : "All categories have been added to the budget."}
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(groupedCategories).map(([group, groupCategories]) => (
                  <div key={group} className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {group}
                    </div>
                    {groupCategories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category)}
                        disabled={isAdding}
                        className={`
                          w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700
                          disabled:opacity-50 disabled:cursor-not-allowed
                          transition-colors duration-150 ease-in-out
                          flex items-center gap-3
                        `}
                      >
                        {category.color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {category.name}
                          </div>
                          {category.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {category.description}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            Categories are managed in Settings
          </div>
        </div>
      )}
    </div>
  );
}
