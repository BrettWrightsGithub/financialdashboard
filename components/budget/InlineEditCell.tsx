"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/cashflow";

interface InlineEditCellProps {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  testId?: string;
}

export function InlineEditCell({
  value,
  onSave,
  disabled = false,
  placeholder = "$0",
  className = "",
  testId,
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset edit value when the displayed value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue("");
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled || isLoading) return;
    
    setIsEditing(true);
    setError(null);
    // Initialize with current value (without formatting)
    setEditValue(value.toString());
  };

  const handleSave = async () => {
    if (isLoading) return;

    // Parse the input value
    const parsedValue = parseFloat(editValue.replace(/[^0-9.-]/g, ""));
    
    // Validate the parsed value
    if (isNaN(parsedValue)) {
      setError("Invalid number");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave(parsedValue);
      setIsEditing(false);
      setEditValue("");
    } catch (err) {
      setError("Failed to save");
      console.error("Error saving inline edit:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isLoading) return;
    
    setIsEditing(false);
    setEditValue("");
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Save on tab, then let parent handle tab navigation
      handleSave();
    }
  };

  const handleBlur = () => {
    // Auto-save on blur if we have a valid value
    if (editValue.trim()) {
      const parsedValue = parseFloat(editValue.replace(/[^0-9.-]/g, ""));
      if (!isNaN(parsedValue)) {
        handleSave();
      } else {
        handleCancel();
      }
    } else {
      handleCancel();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Allow numbers, decimal points, minus signs, and basic formatting
    if (newValue === "" || /^-?\d*\.?\d*$/.test(newValue.replace(/[^0-9.-]/g, ""))) {
      setEditValue(newValue);
      setError(null);
    }
  };

  if (disabled) {
    return (
      <span className={`text-slate-400 dark:text-slate-500 ${className}`}>
        {formatCurrency(value)}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isLoading}
          className={`
            w-full px-2 py-1 text-right border rounded
            ${error ? 'border-red-300 text-red-900' : 'border-blue-300'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            focus:outline-none focus:ring-2 focus:ring-blue-500
            ${className}
          `}
          placeholder={placeholder}
          data-testid={testId}
        />
        {error && (
          <div className="absolute top-full left-0 right-0 mt-1 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      disabled={disabled || isLoading}
      className={`
        text-right hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2 py-1
        transition-colors duration-150 ease-in-out
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text'}
        ${className}
      `}
      data-testid={testId}
    >
      {formatCurrency(value)}
    </button>
  );
}
