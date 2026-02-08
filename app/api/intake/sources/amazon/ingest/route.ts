import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { parseAmazonIngestPayload } from "@/lib/intake/amazon/contracts";
import { ingestAmazonPayload } from "@/lib/intake/amazon/ingest";
import { extractBearerToken, verifyAmazonIngestToken } from "@/lib/intake/sourceTokens";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    const bearerToken = extractBearerToken(request.headers.get("authorization"));
    const tokenCheck = await verifyAmazonIngestToken(supabase, bearerToken);

    if (!tokenCheck.valid) {
      return NextResponse.json({ error: tokenCheck.reason || "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = parseAmazonIngestPayload(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await ingestAmazonPayload(supabase, parsed.data);

    return NextResponse.json({
      success: true,
      source_type: "amazon_extension",
      install_id: tokenCheck.install_id,
      ingest: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest amazon payload";
    console.error("Amazon ingest error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
