import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { parseRuleWithProvider } from "@/lib/assistant/provider";
import { logTelemetryEvent } from "@/lib/telemetry";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const track = async (
    status: number,
    debug: { llm_call?: { provider?: string; model?: string; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; used_regex_fallback?: boolean; fallback_reason?: string } | undefined,
    metadata: Record<string, unknown>
  ) => {
    const llm = debug?.llm_call;
    await logTelemetryEvent({
      eventType: "assistant_call",
      eventName: "assistant_parse_rule",
      route: "/api/assistant/parse-rule",
      httpMethod: "POST",
      httpStatus: status,
      latencyMs: Date.now() - startedAt,
      provider: llm?.provider ?? null,
      model: llm?.model ?? null,
      promptTokens: llm?.prompt_tokens ?? null,
      completionTokens: llm?.completion_tokens ?? null,
      totalTokens: llm?.total_tokens ?? null,
      userAgent: request.headers.get("user-agent"),
      metadata: {
        ...metadata,
        used_regex_fallback: debug?.used_regex_fallback ?? null,
        fallback_reason: debug?.fallback_reason ?? null,
      },
    });
  };

  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      await track(400, undefined, { assistant_status: "error", reason: "message_required" });
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const result = await parseRuleWithProvider(message);
    if (!result.rule) {
      const status = result.response?.includes("_API_KEY") ? 503 : 200;
      await track(status, result.debug, { assistant_status: "ask_details" });
      return NextResponse.json(result, { status });
    }

    const supabase = createServerSupabaseClient();
    const categoryName = result.rule.assign_category_name;

    if (categoryName) {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .limit(500);

      const normalizedTarget = normalize(categoryName);
      const exact = (categories || []).find((category) => normalize(category.name) === normalizedTarget);

      if (exact) {
        result.rule.assign_category_id = exact.id;
      } else {
        const tokens = normalizedTarget.split(" ").filter(Boolean);
        let best: { id: string; score: number } | null = null;
        for (const category of categories || []) {
          const categoryNameNormalized = normalize(category.name);
          const score = tokens.reduce((acc, token) => acc + (categoryNameNormalized.includes(token) ? 1 : 0), 0);
          if (!best || score > best.score) {
            best = { id: category.id, score };
          }
        }
        result.rule.assign_category_id = best && best.score > 0 ? best.id : null;
      }
    }

    if (!result.rule.assign_category_id) {
      await track(200, result.debug, { assistant_status: "ask_details", reason: "category_unmatched" });
      return NextResponse.json({
        clarification: `I parsed the rule, but I couldn't match category "${categoryName}" to an existing category.`,
        rule: result.rule,
      });
    }

    await track(200, result.debug, { assistant_status: "show_review", rule_parsed: true });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Assistant parse error:", error);
    await logTelemetryEvent({
      eventType: "assistant_call",
      eventName: "assistant_parse_rule",
      route: "/api/assistant/parse-rule",
      httpMethod: "POST",
      httpStatus: 500,
      latencyMs: Date.now() - startedAt,
      userAgent: request.headers.get("user-agent"),
      metadata: { assistant_status: "error" },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse rule" },
      { status: 500 }
    );
  }
}
