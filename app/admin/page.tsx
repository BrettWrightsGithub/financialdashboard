"use client";

import { useState, useEffect, useCallback } from "react";
import type { HealthReport } from "@/lib/health";

function getTablesFromDetails(
  details: Record<string, unknown> | undefined
): Record<string, boolean> | null {
  const tablesUnknown = details?.["tables"];
  if (!tablesUnknown || typeof tablesUnknown !== "object" || Array.isArray(tablesUnknown)) {
    return null;
  }

  const tables = tablesUnknown as Record<string, unknown>;
  const result: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(tables)) {
    if (typeof v === "boolean") result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export default function AdminPage() {
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthReport(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch health status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok":
      case "healthy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "error":
      case "unhealthy":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
      case "healthy":
        return "✓";
      case "degraded":
        return "⚠";
      case "error":
      case "unhealthy":
        return "✗";
      default:
        return "?";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          System Health Dashboard
        </h1>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {healthReport && (
        <>
          {/* Overall Status Card */}
          <div className="mb-6 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Overall Status
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-xl ${getStatusColor(
                      healthReport.overall
                    )}`}
                  >
                    {getStatusIcon(healthReport.overall)}
                  </span>
                  <span className="text-2xl font-semibold text-slate-900 dark:text-white capitalize">
                    {healthReport.overall}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                <p>Last checked</p>
                <p className="font-mono">
                  {lastRefresh?.toLocaleTimeString() || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Individual Checks */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Service Checks
            </h2>
            {healthReport.checks.map((check, idx) => (
              <div
                key={idx}
                className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm ${getStatusColor(
                        check.status
                      )}`}
                    >
                      {getStatusIcon(check.status)}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {check.service}
                    </span>
                  </div>
                  {check.latencyMs !== undefined && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {check.latencyMs}ms
                    </span>
                  )}
                </div>

                {check.error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {String(check.error)}
                  </p>
                )}

                {check.details && (
                  <div className="mt-3 text-sm">
                    {(() => {
                      const tables = getTablesFromDetails(check.details);
                      if (!tables) return null;
                      return (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(tables).map(([table, ok]) => (
                          <span
                            key={table}
                            className={`px-2 py-1 rounded text-xs font-mono ${
                              ok
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                          >
                            {table}: {ok ? "✓" : "✗"}
                          </span>
                        ))}
                      </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* API Endpoint Info */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <strong>API Endpoint:</strong>{" "}
              <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
                GET /api/health
              </code>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Use this endpoint for external monitoring services (e.g., UptimeRobot, Pingdom)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
