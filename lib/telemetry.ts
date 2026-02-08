import { createServerSupabaseClient } from "@/lib/supabase";

export type TelemetryEventType = "api_call" | "assistant_call" | "client_behavior";

export interface TelemetryEventInput {
  eventType: TelemetryEventType;
  eventName: string;
  route?: string | null;
  httpMethod?: string | null;
  httpStatus?: number | null;
  latencyMs?: number | null;
  provider?: string | null;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  sessionId?: string | null;
  pagePath?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

function toNullableInt(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export async function logTelemetryEvent(input: TelemetryEventInput): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    await supabase.from("app_events").insert({
      event_type: input.eventType,
      event_name: input.eventName,
      route: input.route ?? null,
      http_method: input.httpMethod ?? null,
      http_status: toNullableInt(input.httpStatus),
      latency_ms: toNullableInt(input.latencyMs),
      provider: input.provider ?? null,
      model: input.model ?? null,
      prompt_tokens: toNullableInt(input.promptTokens),
      completion_tokens: toNullableInt(input.completionTokens),
      total_tokens: toNullableInt(input.totalTokens),
      session_id: input.sessionId ?? null,
      page_path: input.pagePath ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    // Telemetry must never break user flows.
    if (process.env.NODE_ENV !== "test") {
      console.warn("Telemetry logging failed:", error);
    }
  }
}
