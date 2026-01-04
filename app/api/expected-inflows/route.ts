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
      .from("expected_inflows")
      .select(`
        *,
        categories (
          id,
          name,
          cashflow_group,
          color,
          icon
        ),
        counterparties (
          id,
          name,
          type,
          notes
        )
      `)
      .eq("month", monthDate)
      .order("expected_date");

    if (error) {
      console.error("Error fetching expected inflows:", error);
      return NextResponse.json(
        { error: "Failed to fetch expected inflows" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/expected-inflows:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      source, 
      counterparty_id, 
      expected_amount, 
      expected_date, 
      recurrence, 
      category_id, 
      month, 
      notes 
    } = body;

    // Validate required fields
    if (!source || !expected_amount || !month) {
      return NextResponse.json(
        { error: "Missing required fields: source, expected_amount, month" },
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
    if (typeof expected_amount !== "number" || isNaN(expected_amount)) {
      return NextResponse.json(
        { error: "Expected amount must be a valid number" },
        { status: 400 }
      );
    }

    // Validate expected_date if provided
    if (expected_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(expected_date)) {
        return NextResponse.json(
          { error: "Invalid expected_date format. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }
    }

    // Validate recurrence if provided
    if (recurrence && !["monthly", "weekly", "one-time"].includes(recurrence)) {
      return NextResponse.json(
        { error: "Invalid recurrence. Must be: monthly, weekly, or one-time" },
        { status: 400 }
      );
    }

    // Convert to first day of month for database
    const monthDate = `${month}-01`;

    // Create the expected inflow
    const { data, error } = await supabase
      .from("expected_inflows")
      .insert({
        source,
        counterparty_id: counterparty_id || null,
        expected_amount,
        expected_date: expected_date || null,
        recurrence: recurrence || null,
        category_id: category_id || null,
        month: monthDate,
        notes: notes || null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        categories (
          id,
          name,
          cashflow_group,
          color,
          icon
        ),
        counterparties (
          id,
          name,
          type,
          notes
        )
      `)
      .single();

    if (error) {
      console.error("Error creating expected inflow:", error);
      
      // Handle foreign key violations
      if (error.code === "23503") {
        const field = error.message.includes("counterparty_id") 
          ? "counterparty_id" 
          : error.message.includes("category_id") 
          ? "category_id" 
          : "foreign key";
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to create expected inflow" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error in POST /api/expected-inflows:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      source, 
      counterparty_id, 
      expected_amount, 
      expected_date, 
      recurrence, 
      category_id, 
      notes,
      status,
      actual_amount,
      actual_date
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Expected inflow ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid expected inflow ID format" },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (source !== undefined) updateData.source = source;
    if (counterparty_id !== undefined) updateData.counterparty_id = counterparty_id;
    if (expected_amount !== undefined) updateData.expected_amount = expected_amount;
    if (expected_date !== undefined) updateData.expected_date = expected_date;
    if (recurrence !== undefined) updateData.recurrence = recurrence;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (actual_amount !== undefined) updateData.actual_amount = actual_amount;
    if (actual_date !== undefined) updateData.actual_date = actual_date;

    // Validate amount if provided
    if (expected_amount !== undefined && (typeof expected_amount !== "number" || isNaN(expected_amount))) {
      return NextResponse.json(
        { error: "Expected amount must be a valid number" },
        { status: 400 }
      );
    }

    // Validate actual amount if provided
    if (actual_amount !== undefined && (typeof actual_amount !== "number" || isNaN(actual_amount))) {
      return NextResponse.json(
        { error: "Actual amount must be a valid number" },
        { status: 400 }
      );
    }

    // Validate dates if provided
    if (expected_date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(expected_date)) {
        return NextResponse.json(
          { error: "Invalid expected_date format. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }
    }

    if (actual_date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(actual_date)) {
        return NextResponse.json(
          { error: "Invalid actual_date format. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }
    }

    // Validate recurrence if provided
    if (recurrence !== undefined && !["monthly", "weekly", "one-time"].includes(recurrence)) {
      return NextResponse.json(
        { error: "Invalid recurrence. Must be: monthly, weekly, or one-time" },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status !== undefined && !["pending", "received", "partial", "missed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, received, partial, or missed" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("expected_inflows")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        categories (
          id,
          name,
          cashflow_group,
          color,
          icon
        ),
        counterparties (
          id,
          name,
          type,
          notes
        )
      `)
      .single();

    if (error) {
      console.error("Error updating expected inflow:", error);
      
      // Handle not found
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Expected inflow not found" },
          { status: 404 }
        );
      }
      
      // Handle foreign key violations
      if (error.code === "23503") {
        const field = error.message.includes("counterparty_id") 
          ? "counterparty_id" 
          : error.message.includes("category_id") 
          ? "category_id" 
          : "foreign key";
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to update expected inflow" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error in PUT /api/expected-inflows:", error);
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
        { error: "Expected inflow ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid expected inflow ID format" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("expected_inflows")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting expected inflow:", error);
      
      // Handle not found
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Expected inflow not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to delete expected inflow" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/expected-inflows:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
