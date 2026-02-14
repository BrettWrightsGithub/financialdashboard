"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HealthReport } from "@/lib/health";

interface RouteCallMetric {
  route: string;
  count: number;
  errors: number;
  avgLatencyMs: number;
}

interface NamedCountMetric {
  name: string;
  count: number;
}

interface AdminMetricsReport {
  generatedAt: string;
  windowDays: number;
  telemetryConfigured: boolean;
  warnings: string[];
  calls: {
    total: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    byRoute: RouteCallMetric[];
  };
  assistant: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    avgTokensPerCall: number;
    byProvider: NamedCountMetric[];
    byModel: NamedCountMetric[];
  };
  behavior: {
    totalEvents: number;
    uniqueSessions: number;
    pageViews: number;
    topPages: NamedCountMetric[];
    topActions: NamedCountMetric[];
  };
  operations: {
    transactionsTotal: number;
    uncategorizedTransactions: number;
    activeRules: number;
    expectedInflowsPendingThisMonth: number;
    splitParents: number;
    intakeNeedsReview: number | null;
  };
}

function getTablesFromDetails(
  details: Record<string, unknown> | undefined
): Record<string, boolean> | null {
  const tablesUnknown = details?.tables;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatMetricLabel(label: string): string {
  if (label.startsWith("/")) return label;
  return label.replace(/_/g, " ");
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function TopList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: NamedCountMetric[];
  emptyText: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-300 truncate pr-3">
                {formatMetricLabel(item.name)}
              </span>
              <span className="font-mono text-slate-900 dark:text-white">{formatNumber(item.count)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [windowDays, setWindowDays] = useState(7);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [metricsReport, setMetricsReport] = useState<AdminMetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [metricsRes, healthRes] = await Promise.all([
        fetch(`/api/admin/metrics?window_days=${windowDays}`),
        fetch("/api/health"),
      ]);

      const [metricsPayload, healthPayload] = await Promise.all([
        metricsRes.json(),
        healthRes.json(),
      ]);

      if (!metricsRes.ok) {
        throw new Error(metricsPayload?.error || "Failed to fetch admin metrics");
      }
      if (!healthRes.ok) {
        throw new Error(healthPayload?.error || "Failed to fetch health status");
      }

      setMetricsReport(metricsPayload as AdminMetricsReport);
      setHealthReport(healthPayload as HealthReport);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const generatedAt = useMemo(() => {
    if (!metricsReport?.generatedAt) return "n/a";
    return new Date(metricsReport.generatedAt).toLocaleString();
  }, [metricsReport?.generatedAt]);

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Analytics Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Calls, assistant token usage, behavior telemetry, and operational metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-300" htmlFor="window-days">
            Window
          </label>
          <select
            id="window-days"
            value={windowDays}
            onChange={(event) => setWindowDays(Number(event.target.value))}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 p-3 text-sm text-slate-700 dark:text-slate-300">
        <span className="font-medium">Generated:</span> {generatedAt}
        <span className="mx-2">•</span>
        <span className="font-medium">Last refresh:</span> {lastRefresh ? lastRefresh.toLocaleTimeString() : "n/a"}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : null}

      {metricsReport ? (
        <>
          {!metricsReport.telemetryConfigured && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-amber-800 dark:text-amber-300">
                Telemetry table is not configured yet. Run migration{" "}
                <code>supabase/migrations/20260208_admin_telemetry_dashboard.sql</code>.
              </p>
            </div>
          )}

          {metricsReport.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-1">
              {metricsReport.warnings.map((warning) => (
                <p key={warning} className="text-sm text-amber-800 dark:text-amber-300">
                  {warning}
                </p>
              ))}
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">API Calls</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total Calls" value={formatNumber(metricsReport.calls.total)} />
              <MetricCard label="Success Rate" value={formatPercent(metricsReport.calls.successRate)} />
              <MetricCard label="Avg Latency" value={`${formatNumber(metricsReport.calls.avgLatencyMs)}ms`} />
              <MetricCard label="P95 Latency" value={`${formatNumber(metricsReport.calls.p95LatencyMs)}ms`} />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Routes</h3>
              {metricsReport.calls.byRoute.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No call telemetry for this window.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400">
                        <th className="pb-2 pr-4">Route</th>
                        <th className="pb-2 pr-4">Calls</th>
                        <th className="pb-2 pr-4">Errors</th>
                        <th className="pb-2 pr-4">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricsReport.calls.byRoute.map((route) => (
                        <tr key={route.route} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="py-2 pr-4 font-mono text-xs text-slate-800 dark:text-slate-200">
                            {route.route}
                          </td>
                          <td className="py-2 pr-4">{formatNumber(route.count)}</td>
                          <td className="py-2 pr-4">{formatNumber(route.errors)}</td>
                          <td className="py-2 pr-4">{formatNumber(route.avgLatencyMs)}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Assistant Usage</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Assistant Calls" value={formatNumber(metricsReport.assistant.calls)} />
              <MetricCard label="Total Tokens" value={formatNumber(metricsReport.assistant.totalTokens)} />
              <MetricCard label="Prompt Tokens" value={formatNumber(metricsReport.assistant.promptTokens)} />
              <MetricCard
                label="Avg Tokens / Call"
                value={formatNumber(metricsReport.assistant.avgTokensPerCall)}
                hint={`Completion: ${formatNumber(metricsReport.assistant.completionTokens)}`}
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <TopList
                title="Top Providers"
                items={metricsReport.assistant.byProvider}
                emptyText="No provider telemetry yet."
              />
              <TopList
                title="Top Models"
                items={metricsReport.assistant.byModel}
                emptyText="No model telemetry yet."
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">User Behavior</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Behavior Events" value={formatNumber(metricsReport.behavior.totalEvents)} />
              <MetricCard label="Unique Sessions" value={formatNumber(metricsReport.behavior.uniqueSessions)} />
              <MetricCard label="Page Views" value={formatNumber(metricsReport.behavior.pageViews)} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <TopList
                title="Top Pages"
                items={metricsReport.behavior.topPages}
                emptyText="No page view events yet."
              />
              <TopList
                title="Top Actions"
                items={metricsReport.behavior.topActions}
                emptyText="No action events yet."
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Operational Signals</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard label="Transactions (Total)" value={formatNumber(metricsReport.operations.transactionsTotal)} />
              <MetricCard
                label="Uncategorized Posted"
                value={formatNumber(metricsReport.operations.uncategorizedTransactions)}
              />
              <MetricCard label="Active Rules" value={formatNumber(metricsReport.operations.activeRules)} />
              <MetricCard
                label="Pending Inflows (Month)"
                value={formatNumber(metricsReport.operations.expectedInflowsPendingThisMonth)}
              />
              <MetricCard label="Split Parents" value={formatNumber(metricsReport.operations.splitParents)} />
              <MetricCard
                label="Intake Needs Review"
                value={
                  metricsReport.operations.intakeNeedsReview === null
                    ? "n/a"
                    : formatNumber(metricsReport.operations.intakeNeedsReview)
                }
              />
            </div>
          </section>
        </>
      ) : null}

      {healthReport && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Service Health</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {healthReport.checks.map((check, idx) => (
              <div
                key={`${check.service}-${idx}`}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900 dark:text-white">{check.service}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      check.status === "ok"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                {typeof check.latencyMs === "number" && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{check.latencyMs}ms</p>
                )}
                {check.error && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-300">{String(check.error)}</p>
                )}
                {check.details && (
                  <div className="mt-2">
                    {(() => {
                      const tables = getTablesFromDetails(check.details);
                      if (!tables) return null;
                      return (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(tables).map(([table, ok]) => (
                            <span
                              key={table}
                              className={`rounded px-1.5 py-0.5 text-[11px] font-mono ${
                                ok
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              }`}
                            >
                              {table}: {ok ? "ok" : "error"}
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
        </section>
      )}
    </div>
  );
}
