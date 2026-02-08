import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

function isMissingColumnError(message: string, column: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    normalized.includes(column.toLowerCase()) &&
    normalized.includes("does not exist")
  ) || (normalized.includes("could not find") && normalized.includes(column.toLowerCase()));
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const displayName = normalizeString(body.display_name);
    const owner = normalizeString(body.owner);
    const subtype = normalizeString(body.subtype);

    if (!displayName && !owner && !subtype) {
      return NextResponse.json(
        { error: "At least one of display_name, owner, or subtype is required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const updatePayload: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };

    if (displayName) updatePayload.display_name = displayName;
    if (owner) updatePayload.owner = owner;
    if (subtype) updatePayload.subtype = subtype;

    let updateResult:
      | { data: Record<string, unknown> | null; error: { message: string } | null }
      | any = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      updateResult = await supabase
        .from("accounts")
        .update({ ...updatePayload })
        .eq("id", id)
        .select("*")
        .single();

      if (!updateResult.error) {
        break;
      }

      if (
        isMissingColumnError(updateResult.error.message, "display_name") &&
        typeof updatePayload.display_name === "string"
      ) {
        updatePayload.name = updatePayload.display_name;
        delete updatePayload.display_name;
        continue;
      }

      if (
        isMissingColumnError(updateResult.error.message, "subtype") &&
        typeof updatePayload.subtype === "string"
      ) {
        updatePayload.account_type = updatePayload.subtype;
        delete updatePayload.subtype;
        continue;
      }

      break;
    }

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    const account = updateResult.data
      ? {
          ...updateResult.data,
          display_name:
            typeof updateResult.data.display_name === "string"
              ? updateResult.data.display_name
              : typeof updateResult.data.name === "string"
                ? updateResult.data.name
                : displayName ?? null,
          owner:
            typeof updateResult.data.owner === "string"
              ? updateResult.data.owner
              : owner ?? "Joint",
          subtype:
            typeof updateResult.data.subtype === "string"
              ? updateResult.data.subtype
              : typeof updateResult.data.account_type === "string"
                ? updateResult.data.account_type
                : subtype ?? "other",
        }
      : null;

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update account" },
      { status: 500 }
    );
  }
}
