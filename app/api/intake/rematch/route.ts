import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { runIntakeRematch } from "@/lib/intake/rematch";
import type { IntakeSourceType } from "@/types/database";

const ALLOWED_SOURCES = new Set<IntakeSourceType>(["upload", "csv", "amazon_extension"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const source = (body?.source || "amazon_extension") as IntakeSourceType;
    const limit = body?.limit ? Number(body.limit) : undefined;

    if (!ALLOWED_SOURCES.has(source)) {
      return NextResponse.json({ error: "Invalid source for rematch" }, { status: 400 });
    }

    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
      return NextResponse.json({ error: "limit must be an integer between 1 and 1000" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const summary = await runIntakeRematch(supabase, {
      sourceType: source,
      limit,
    });

    return NextResponse.json({
      success: true,
      rematch: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run rematch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
