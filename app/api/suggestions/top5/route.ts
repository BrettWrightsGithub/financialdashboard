import { NextResponse } from "next/server";
import { getTop5Suggestions } from "@/lib/categorization/priorityScoring";

export async function GET() {
  const suggestions = await getTop5Suggestions();
  return NextResponse.json({ suggestions });
}
