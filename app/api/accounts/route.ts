import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { logTelemetryEvent } from "@/lib/telemetry";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const track = async (status: number, metadata?: Record<string, unknown>) => {
    await logTelemetryEvent({
      eventType: "api_call",
      eventName: "accounts_list",
      route: "/api/accounts",
      httpMethod: "GET",
      httpStatus: status,
      latencyMs: Date.now() - startedAt,
      userAgent: request.headers.get("user-agent"),
      metadata: metadata || {},
    });
  };

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      await track(500, { reason: "query_error" });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalizedAccounts = (data || []).map((account: Record<string, unknown>) => ({
      ...account,
      display_name:
        typeof account.display_name === "string"
          ? account.display_name
          : typeof account.name === "string"
            ? account.name
            : null,
      owner:
        typeof account.owner === "string" && account.owner.trim().length > 0
          ? account.owner
          : "Joint",
      subtype:
        typeof account.subtype === "string" && account.subtype.trim().length > 0
          ? account.subtype
          : typeof account.account_type === "string" && account.account_type.trim().length > 0
            ? account.account_type
            : "other",
      institution_name:
        typeof account.institution_name === "string"
          ? account.institution_name
          : typeof account.institution === "string"
            ? account.institution
            : null,
    }));

    await track(200, { returned_count: normalizedAccounts.length });
    return NextResponse.json({ accounts: normalizedAccounts });
  } catch (error) {
    await track(500, { reason: "exception" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
