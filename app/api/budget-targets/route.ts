import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
      return NextResponse.json(
        { error: "Month parameter is required (format: YYYY-MM)" },
        { status: 400 }
      );
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    // Convert to first day of month for database query
    const monthDate = `${month}-01`;

    const { data, error } = await supabase
      .from("budget_targets")
      .select(`
        *,
        categories (
          id,
          name,
          cashflow_group,
          color,
          icon
        )
      `)
      .eq("month", monthDate)
      .order("created_at");

    if (error) {
      console.error("Error fetching budget targets:", error);
      return NextResponse.json(
        { error: "Failed to fetch budget targets" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/budget-targets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category_id, month, amount, notes } = body;

    // Validate required fields
    if (!category_id || !month || amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: category_id, month, amount" },
        { status: 400 }
      );
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    // Validate amount is a number
    if (typeof amount !== "number" || isNaN(amount)) {
      return NextResponse.json(
        { error: "Amount must be a valid number" },
        { status: 400 }
      );
    }

    // Convert to first day of month for database
    const monthDate = `${month}-01`;

    // Upsert the budget target
    const { data, error } = await supabase
      .from("budget_targets")
      .upsert(
        {
          category_id,
          month: monthDate,
          amount,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "category_id,month",
        }
      )
      .select(`
        *,
        categories (
          id,
          name,
          cashflow_group,
          color,
          icon
        )
      `)
      .single();

    if (error) {
      console.error("Error upserting budget target:", error);
      
      // Handle unique constraint violation
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Budget target already exists for this category and month" },
          { status: 409 }
        );
      }
      
      // Handle foreign key violation
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Invalid category_id" },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to save budget target" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error in POST /api/budget-targets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Budget target ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid budget target ID format" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("budget_targets")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting budget target:", error);
      
      // Handle not found
      if (error.code === "0") {
        return NextResponse.json(
          { error: "Budget target not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to delete budget target" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/budget-targets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
