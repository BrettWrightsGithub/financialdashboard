import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { parseRuleWithProvider } from "@/lib/assistant/provider";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const result = await parseRuleWithProvider(message);
    if (!result.rule) {
      const status = result.response?.includes("_API_KEY") ? 503 : 200;
      return NextResponse.json(result, { status });
    }

    const supabase = createServerSupabaseClient();
    const categoryName = result.rule.assign_category_name;

    if (categoryName) {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .limit(500);

      const normalizedTarget = normalize(categoryName);
      const exact = (categories || []).find((category) => normalize(category.name) === normalizedTarget);

      if (exact) {
        result.rule.assign_category_id = exact.id;
      } else {
        const tokens = normalizedTarget.split(" ").filter(Boolean);
        let best: { id: string; score: number } | null = null;
        for (const category of categories || []) {
          const categoryNameNormalized = normalize(category.name);
          const score = tokens.reduce((acc, token) => acc + (categoryNameNormalized.includes(token) ? 1 : 0), 0);
          if (!best || score > best.score) {
            best = { id: category.id, score };
          }
        }
        result.rule.assign_category_id = best && best.score > 0 ? best.id : null;
      }
    }

    if (!result.rule.assign_category_id) {
      return NextResponse.json({
        clarification: `I parsed the rule, but I couldn't match category "${categoryName}" to an existing category.`,
        rule: result.rule,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Assistant parse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse rule" },
      { status: 500 }
    );
  }
}
