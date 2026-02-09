import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type ReviewAction = "confirm_match" | "reject_match" | "mark_ready_to_apply" | "mark_needs_review";

const ALLOWED_ACTIONS = new Set<ReviewAction>([
  "confirm_match",
  "reject_match",
  "mark_ready_to_apply",
  "mark_needs_review",
]);

interface ArtifactRow {
  id: string;
  status: string;
}

interface ExtractionRow {
  id: string;
  artifact_id: string;
}

interface MatchRow {
  id: string;
  extraction_id: string;
  status: string;
  transaction_id: string | null;
  match_reason: string | null;
}

function buildMatchReason(baseReason: string | null, suffix: string): string {
  if (!baseReason || baseReason.trim().length === 0) {
    return suffix;
  }
  return `${baseReason} ${suffix}`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const artifactId = typeof body?.artifact_id === "string" ? body.artifact_id : "";
    const action = body?.action as ReviewAction;
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!artifactId) {
      return NextResponse.json({ error: "artifact_id is required" }, { status: 400 });
    }

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const now = new Date().toISOString();

    const { data: artifact, error: artifactError } = await supabase
      .from("intake_artifacts")
      .select("id, status")
      .eq("id", artifactId)
      .maybeSingle();

    if (artifactError) {
      return NextResponse.json({ error: artifactError.message }, { status: 500 });
    }

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const artifactRow = artifact as ArtifactRow;

    const { data: extraction, error: extractionError } = await supabase
      .from("intake_extractions")
      .select("id, artifact_id")
      .eq("artifact_id", artifactId)
      .maybeSingle();

    if (extractionError) {
      return NextResponse.json({ error: extractionError.message }, { status: 500 });
    }

    if (!extraction) {
      return NextResponse.json({ error: "No extraction exists for this artifact" }, { status: 400 });
    }

    const extractionRow = extraction as ExtractionRow;

    const { data: match, error: matchError } = await supabase
      .from("intake_matches")
      .select("id, extraction_id, status, transaction_id, match_reason")
      .eq("extraction_id", extractionRow.id)
      .maybeSingle();

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    const matchRow = (match || null) as MatchRow | null;

    if (action === "confirm_match") {
      if (!matchRow?.transaction_id) {
        return NextResponse.json(
          { error: "Cannot confirm match: no candidate transaction is linked." },
          { status: 400 }
        );
      }

      const { error: updateMatchError } = await supabase
        .from("intake_matches")
        .update({
          status: "confirmed",
          match_reason: buildMatchReason(matchRow.match_reason, "Confirmed by user."),
          updated_at: now,
        })
        .eq("id", matchRow.id);

      if (updateMatchError) {
        return NextResponse.json({ error: updateMatchError.message }, { status: 500 });
      }

      const { error: updateArtifactError } = await supabase
        .from("intake_artifacts")
        .update({ status: "ready_to_apply", updated_at: now })
        .eq("id", artifactRow.id);

      if (updateArtifactError) {
        return NextResponse.json({ error: updateArtifactError.message }, { status: 500 });
      }
    }

    if (action === "reject_match") {
      const rejectionReason = note || "Rejected by user during intake review.";

      if (matchRow) {
        const { error: updateMatchError } = await supabase
          .from("intake_matches")
          .update({
            status: "rejected",
            transaction_id: null,
            match_confidence: null,
            match_reason: rejectionReason,
            updated_at: now,
          })
          .eq("id", matchRow.id);

        if (updateMatchError) {
          return NextResponse.json({ error: updateMatchError.message }, { status: 500 });
        }
      } else {
        const { error: insertMatchError } = await supabase.from("intake_matches").insert({
          extraction_id: extractionRow.id,
          status: "rejected",
          transaction_id: null,
          match_confidence: null,
          match_reason: rejectionReason,
          updated_at: now,
        });

        if (insertMatchError) {
          return NextResponse.json({ error: insertMatchError.message }, { status: 500 });
        }
      }

      const { error: updateArtifactError } = await supabase
        .from("intake_artifacts")
        .update({ status: "needs_review", updated_at: now })
        .eq("id", artifactRow.id);

      if (updateArtifactError) {
        return NextResponse.json({ error: updateArtifactError.message }, { status: 500 });
      }
    }

    if (action === "mark_ready_to_apply") {
      const { error: updateArtifactError } = await supabase
        .from("intake_artifacts")
        .update({ status: "ready_to_apply", updated_at: now })
        .eq("id", artifactRow.id);

      if (updateArtifactError) {
        return NextResponse.json({ error: updateArtifactError.message }, { status: 500 });
      }

      if (matchRow?.status === "suggested" && matchRow.transaction_id) {
        const { error: updateMatchError } = await supabase
          .from("intake_matches")
          .update({
            status: "confirmed",
            match_reason: buildMatchReason(matchRow.match_reason, "Marked ready to apply by user."),
            updated_at: now,
          })
          .eq("id", matchRow.id);

        if (updateMatchError) {
          return NextResponse.json({ error: updateMatchError.message }, { status: 500 });
        }
      }
    }

    if (action === "mark_needs_review") {
      const { error: updateArtifactError } = await supabase
        .from("intake_artifacts")
        .update({ status: "needs_review", updated_at: now })
        .eq("id", artifactRow.id);

      if (updateArtifactError) {
        return NextResponse.json({ error: updateArtifactError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      artifact_id: artifactRow.id,
      action,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run intake review action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

