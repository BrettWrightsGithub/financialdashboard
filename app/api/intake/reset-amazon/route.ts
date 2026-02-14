import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

interface DeleteResult {
  count: number;
  skipped_missing_table: boolean;
}

function isMissingRelationError(error: { message?: string } | null): boolean {
  if (!error?.message) {
    return false;
  }

  return (
    error.message.includes("Could not find the table") ||
    error.message.includes("does not exist") ||
    error.message.includes("schema cache")
  );
}

async function deleteBySource(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  table: "intake_rematch_runs" | "intake_source_tokens" | "intake_artifacts",
  options?: { allowMissingTable?: boolean }
): Promise<DeleteResult> {
  const allowMissingTable = options?.allowMissingTable ?? false;
  const { count, error } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("source_type", "amazon_extension")
    .select("id");

  if (error) {
    if (allowMissingTable && isMissingRelationError(error)) {
      return { count: 0, skipped_missing_table: true };
    }
    throw new Error(`Failed to clear ${table}: ${error.message}`);
  }

  return { count: count || 0, skipped_missing_table: false };
}

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();

    const rematch = await deleteBySource(supabase, "intake_rematch_runs", {
      allowMissingTable: true,
    });
    const tokens = await deleteBySource(supabase, "intake_source_tokens", {
      allowMissingTable: true,
    });
    const artifacts = await deleteBySource(supabase, "intake_artifacts");

    const { count: remainingAmazonArtifacts, error: remainingError } = await supabase
      .from("intake_artifacts")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "amazon_extension");

    if (remainingError) {
      throw new Error(`Failed to verify remaining Amazon artifacts: ${remainingError.message}`);
    }

    return NextResponse.json({
      success: true,
      deleted: {
        artifacts: artifacts.count,
        rematch_runs: rematch.count,
        tokens: tokens.count,
      },
      skipped_missing_tables: [
        ...(rematch.skipped_missing_table ? ["intake_rematch_runs"] : []),
        ...(tokens.skipped_missing_table ? ["intake_source_tokens"] : []),
      ],
      remaining_amazon_artifacts: remainingAmazonArtifacts || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset Amazon intake";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
