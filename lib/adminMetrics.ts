import { createServerSupabaseClient } from "@/lib/supabase";

export interface RouteCallMetric {
  route: string;
  count: number;
  errors: number;
  avgLatencyMs: number;
}

export interface NamedCountMetric {
  name: string;
  count: number;
}

export interface AdminMetricsReport {
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

interface AppEventRow {
  event_type: "api_call" | "assistant_call" | "client_behavior";
  event_name: string;
  route: string | null;
  http_status: number | null;
  latency_ms: number | null;
  provider: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  page_path: string | null;
  session_id: string | null;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function topCounts(entries: Iterable<string>, limit: number): NamedCountMetric[] {
  const map = new Map<string, number>();
  for (const item of entries) {
    if (!item) continue;
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as Record<string, unknown>;
  const code = typeof err.code === "string" ? err.code : "";
  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return code === "42P01" || message.includes("does not exist") || message.includes("relation");
}

async function countRows(
  table: string,
  apply?: (query: any) => any
): Promise<number> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from(table).select("id", { head: true, count: "exact" });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function getAdminMetrics(windowDays = 7): Promise<AdminMetricsReport> {
  const warnings: string[] = [];
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServerSupabaseClient();

  let telemetryConfigured = true;
  let events: AppEventRow[] = [];

  const { data: eventRows, error: eventsError } = await supabase
    .from("app_events")
    .select(
      "event_type, event_name, route, http_status, latency_ms, provider, model, prompt_tokens, completion_tokens, total_tokens, page_path, session_id"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (eventsError) {
    if (isMissingRelationError(eventsError)) {
      telemetryConfigured = false;
      warnings.push("Telemetry table not found. Apply migration 20260208_admin_telemetry_dashboard.sql.");
    } else {
      throw eventsError;
    }
  } else {
    events = (eventRows || []) as AppEventRow[];
  }

  const apiEvents = events.filter((event) => event.event_type === "api_call" || event.event_type === "assistant_call");
  const successfulCalls = apiEvents.filter((event) => (event.http_status ?? 500) < 400).length;
  const callLatencies = apiEvents
    .map((event) => event.latency_ms)
    .filter((value): value is number => typeof value === "number" && value >= 0);

  const routeMap = new Map<string, { count: number; errors: number; latencySum: number; latencyCount: number }>();
  for (const event of apiEvents) {
    const key = event.route || event.event_name || "unknown";
    const existing = routeMap.get(key) || { count: 0, errors: 0, latencySum: 0, latencyCount: 0 };
    existing.count += 1;
    if ((event.http_status ?? 500) >= 400) existing.errors += 1;
    if (typeof event.latency_ms === "number" && event.latency_ms >= 0) {
      existing.latencySum += event.latency_ms;
      existing.latencyCount += 1;
    }
    routeMap.set(key, existing);
  }

  const byRoute: RouteCallMetric[] = Array.from(routeMap.entries())
    .map(([route, agg]) => ({
      route,
      count: agg.count,
      errors: agg.errors,
      avgLatencyMs: agg.latencyCount > 0 ? round(agg.latencySum / agg.latencyCount) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const assistantEvents = events.filter((event) => event.event_type === "assistant_call");
  const promptTokens = assistantEvents.reduce((sum, event) => sum + (event.prompt_tokens || 0), 0);
  const completionTokens = assistantEvents.reduce((sum, event) => sum + (event.completion_tokens || 0), 0);
  const totalTokens = assistantEvents.reduce((sum, event) => sum + (event.total_tokens || 0), 0);

  const behaviorEvents = events.filter((event) => event.event_type === "client_behavior");
  const pageViews = behaviorEvents.filter((event) => event.event_name === "page_view");
  const uniqueSessions = new Set(
    behaviorEvents.map((event) => event.session_id).filter((value): value is string => typeof value === "string" && value.length > 0)
  );

  const topPages = topCounts(
    pageViews.map((event) => event.page_path || "").filter(Boolean),
    8
  );
  const topActions = topCounts(
    behaviorEvents
      .map((event) => event.event_name)
      .filter((name) => name !== "page_view"),
    8
  );

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    transactionsTotal,
    uncategorizedTransactions,
    activeRules,
    expectedInflowsPendingThisMonth,
    splitParents,
  ] = await Promise.all([
    countRows("transactions"),
    countRows("transactions", (query) =>
      query
        .eq("status", "posted")
        .is("life_category_id", null)
        .eq("is_transfer", false)
        .eq("is_split_parent", false)
    ),
    countRows("categorization_rules", (query) => query.eq("is_active", true)),
    countRows("expected_inflows", (query) => query.eq("status", "pending").eq("month", month)),
    countRows("transactions", (query) => query.eq("is_split_parent", true)),
  ]);

  let intakeNeedsReview: number | null = null;
  try {
    intakeNeedsReview = await countRows("intake_artifacts", (query) =>
      query.in("status", ["needs_review", "error"])
    );
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    warnings.push("Intake tables not found. Intake metrics are unavailable.");
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    telemetryConfigured,
    warnings,
    calls: {
      total: apiEvents.length,
      successRate: apiEvents.length > 0 ? round((successfulCalls / apiEvents.length) * 100) : 0,
      avgLatencyMs: callLatencies.length > 0 ? round(callLatencies.reduce((s, x) => s + x, 0) / callLatencies.length) : 0,
      p95LatencyMs: round(percentile(callLatencies, 95)),
      byRoute,
    },
    assistant: {
      calls: assistantEvents.length,
      promptTokens,
      completionTokens,
      totalTokens,
      avgTokensPerCall: assistantEvents.length > 0 ? round(totalTokens / assistantEvents.length) : 0,
      byProvider: topCounts(
        assistantEvents.map((event) => event.provider || "").filter(Boolean),
        5
      ),
      byModel: topCounts(
        assistantEvents.map((event) => event.model || "").filter(Boolean),
        5
      ),
    },
    behavior: {
      totalEvents: behaviorEvents.length,
      uniqueSessions: uniqueSessions.size,
      pageViews: pageViews.length,
      topPages,
      topActions,
    },
    operations: {
      transactionsTotal,
      uncategorizedTransactions,
      activeRules,
      expectedInflowsPendingThisMonth,
      splitParents,
      intakeNeedsReview,
    },
  };
}
