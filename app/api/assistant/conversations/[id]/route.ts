import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "conversation id is required" }, { status: 400 });
    }

    const projectName = request.nextUrl.searchParams.get("projectName");
    const supabase = createServerSupabaseClient();

    let conversationQuery = supabase
      .from("assistant_conversations")
      .select("id, project_name, title, created_at, updated_at")
      .eq("id", id);

    if (projectName && projectName.trim()) {
      conversationQuery = conversationQuery.eq("project_name", projectName.trim());
    }

    const { data: conversation, error: conversationError } = await conversationQuery.single();
    if (conversationError) {
      const status = conversationError.code === "PGRST116" ? 404 : 500;
      return NextResponse.json({ error: conversationError.message }, { status });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("assistant_messages")
      .select("id, conversation_id, role, content, message_type, metadata_json, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    return NextResponse.json({
      conversation,
      messages: messages || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load conversation" },
      { status: 500 }
    );
  }
}
