import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { logTelemetryEvent } from "@/lib/telemetry";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const track = async (status: number, metadata?: Record<string, unknown>) => {
    await logTelemetryEvent({
      eventType: "api_call",
      eventName: "categories_list",
      route: "/api/categories",
      httpMethod: "GET",
      httpStatus: status,
      latencyMs: Date.now() - startedAt,
      userAgent: request.headers.get("user-agent"),
      metadata: metadata || {},
    });
  };

  try {
    const supabase = createServerSupabaseClient();

    const { data: categories, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      await track(500, { reason: "query_error" });
      throw new Error(error.message);
    }

    await track(200, { returned_count: categories?.length || 0 });
    return NextResponse.json({ categories: categories || [] });
  } catch (error) {
    console.error("Error fetching categories:", error);
    await track(500, { reason: "exception" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
