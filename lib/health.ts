import { supabase } from "./supabase";

export interface HealthCheckResult {
  service: string;
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  timestamp: string;
  overall: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheckResult[];
}

/**
 * Check Supabase connectivity by querying a simple table
 */
async function checkSupabaseConnection(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  if (!supabase) {
    return {
      service: "supabase",
      status: "error",
      error: "Supabase client not initialized - check environment variables",
    };
  }

  try {
    // Simple query to test connectivity - just check if we can reach the DB
    const { error } = await supabase
      .from("accounts")
      .select("id")
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        service: "supabase",
        status: "error",
        latencyMs,
        error: error.message,
        details: { code: error.code, hint: error.hint },
      };
    }

    return {
      service: "supabase",
      status: "ok",
      latencyMs,
    };
  } catch (err) {
    return {
      service: "supabase",
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Check if required tables exist and are accessible
 */
async function checkRequiredTables(): Promise<HealthCheckResult> {
  const requiredTables = ["accounts", "transactions", "categories", "budget_targets"];
  const start = Date.now();
  
  if (!supabase) {
    return {
      service: "supabase-tables",
      status: "error",
      error: "Supabase client not initialized",
    };
  }

  const tableResults: Record<string, boolean> = {};
  
  try {
    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select("id").limit(1);
      tableResults[table] = !error;
    }

    const allOk = Object.values(tableResults).every(Boolean);
    const latencyMs = Date.now() - start;

    return {
      service: "supabase-tables",
      status: allOk ? "ok" : "error",
      latencyMs,
      details: { tables: tableResults },
      error: allOk ? undefined : "Some required tables are not accessible",
    };
  } catch (err) {
    return {
      service: "supabase-tables",
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Run all health checks and return a comprehensive report
 */
export async function runHealthCheck(): Promise<HealthReport> {
  const checks = await Promise.all([
    checkSupabaseConnection(),
    checkRequiredTables(),
  ]);

  const errorCount = checks.filter((c) => c.status === "error").length;
  
  let overall: HealthReport["overall"];
  if (errorCount === 0) {
    overall = "healthy";
  } else if (errorCount < checks.length) {
    overall = "degraded";
  } else {
    overall = "unhealthy";
  }

  return {
    timestamp: new Date().toISOString(),
    overall,
    checks,
  };
}

/**
 * Quick connectivity test - returns true if Supabase is reachable
 */
export async function isSupabaseHealthy(): Promise<boolean> {
  const result = await checkSupabaseConnection();
  return result.status === "ok";
}
