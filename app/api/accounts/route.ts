import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
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

    return NextResponse.json({ accounts: normalizedAccounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
