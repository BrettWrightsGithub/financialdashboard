import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

function normalizeProjectName(value: string | null): string {
  return (value || "").trim();
}

function normalizeConversationTitle(value: unknown): string {
  if (typeof value !== "string") return "New conversation";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "New conversation";
}

export async function GET(request: NextRequest) {
  try {
    const projectName = normalizeProjectName(request.nextUrl.searchParams.get("projectName"));
    if (!projectName) {
      return NextResponse.json({ error: "projectName is required" }, { status: 400 });
    }

    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || "25");
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
      : 25;

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id, project_name, title, created_at, updated_at")
      .eq("project_name", projectName)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectName = normalizeProjectName(
      typeof body?.projectName === "string" ? body.projectName : null
    );

    if (!projectName) {
      return NextResponse.json({ error: "projectName is required" }, { status: 400 });
    }

    const payload = {
      project_name: projectName,
      title: normalizeConversationTitle(body?.title),
    };

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("assistant_conversations")
      .insert(payload)
      .select("id, project_name, title, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create conversation" },
      { status: 500 }
    );
  }
}
