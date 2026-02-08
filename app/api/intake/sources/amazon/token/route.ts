import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { issueAmazonIngestToken, isValidInstallId } from "@/lib/intake/sourceTokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const installId = typeof body?.install_id === "string" ? body.install_id.trim() : "";

    if (!installId) {
      return NextResponse.json({ error: "install_id is required" }, { status: 400 });
    }

    if (!isValidInstallId(installId)) {
      return NextResponse.json(
        { error: "install_id must be 8-128 chars and use only letters, numbers, dot, underscore, hyphen" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const issued = await issueAmazonIngestToken(supabase, installId);

    return NextResponse.json({
      token: issued.token,
      token_type: "Bearer",
      source_type: issued.source_type,
      install_id: issued.install_id,
      expires_at: issued.expires_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to issue source token";
    console.error("Amazon token issue error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
