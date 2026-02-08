import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { logTelemetryEvent } from "@/lib/telemetry";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const track = async (status: number, metadata?: Record<string, unknown>) => {
    await logTelemetryEvent({
      eventType: "api_call",
      eventName: "transactions_list",
      route: "/api/transactions",
      httpMethod: "GET",
      httpStatus: status,
      latencyMs: Date.now() - startedAt,
      userAgent: request.headers.get("user-agent"),
      metadata: metadata || {},
    });
  };

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 500);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = createServerSupabaseClient();
    let query = supabase
      .from("v_transactions_with_details")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .range(from, to);

    const accountId = searchParams.get("account_id");
    const cashflowGroup = searchParams.get("cashflow_group");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    if (accountId) query = query.eq("account_id", accountId);
    if (cashflowGroup) query = query.eq("cashflow_group", cashflowGroup);
    if (search) query = query.ilike("description_raw", `%${search}%`);
    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);

    if (searchParams.get("hide_transfers") === "true") query = query.eq("is_transfer", false);
    if (searchParams.get("hide_pass_through") === "true") query = query.eq("is_pass_through", false);

    const { data, count, error } = await query;
    if (error) {
      await track(500, { reason: "query_error" });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await track(200, { returned_count: data?.length || 0, total_count: count || 0 });
    return NextResponse.json({
      transactions: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    });
  } catch (error) {
    await track(500, { reason: "exception" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
